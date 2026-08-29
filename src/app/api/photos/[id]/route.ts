import { z } from "zod";
import { getApiMember } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import { MOCK_PHOTOS } from "@/lib/mock-data";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000),
    location: z.string().trim().max(100),
    visibility: z.enum(["class", "private"]),
    downloadAllowed: z.boolean(),
    tags: z.array(z.string().trim().min(1).max(30)).max(12),
    peopleIds: z.array(z.string().min(1).max(80)).max(80),
  }),
  z.object({
    action: z.literal("setStatus"),
    reviewStatus: z.enum(["published", "hidden"]),
  }),
]);

type RouteContext = { params: Promise<{ id: string }> };

function notFoundResponse() {
  return Response.json(
    { error: "内容不存在，或你不是它的上传者。" },
    { status: 404 },
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getApiMember();
  if (!user) {
    return Response.json(
      { error: "请先以已通过审核的班级成员身份登录。" },
      { status: 401 },
    );
  }

  const id = (await params).id;
  const parsed = updateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "媒体资料格式不正确。" },
      { status: 400 },
    );
  }

  if (DEMO_MODE) {
    const owned = MOCK_PHOTOS.find(
      (photo) =>
        photo.id === id &&
        photo.uploadedBy === user.id &&
        photo.reviewStatus !== "deleted",
    );
    if (!owned) return notFoundResponse();
    return Response.json({
      ok: true,
      photo:
        parsed.data.action === "update"
          ? {
              id,
              ...parsed.data,
              reviewStatus:
                owned.reviewStatus === "hidden" ? "hidden" : "published",
            }
          : { id, reviewStatus: parsed.data.reviewStatus },
      message: "演示模式已模拟保存，不会写入数据库。",
    });
  }

  const supabase = await createSupabaseAdminClient();
  const { data: owned, error: ownerError } = await supabase
    .from("photos")
    .select("id,review_status")
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .neq("review_status", "deleted")
    .maybeSingle();
  if (ownerError) {
    return Response.json({ error: "读取媒体资料失败。" }, { status: 500 });
  }
  if (!owned) return notFoundResponse();

  if (parsed.data.action === "setStatus") {
    const { data: updated, error } = await supabase
      .from("photos")
      .update({
        review_status: parsed.data.reviewStatus,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("uploaded_by", user.id)
      .neq("review_status", "deleted")
      .select("id,review_status")
      .maybeSingle();
    if (error) {
      return Response.json({ error: "媒体状态保存失败。" }, { status: 500 });
    }
    if (!updated) return notFoundResponse();
    return Response.json({
      ok: true,
      photo: {
        id,
        reviewStatus: parsed.data.reviewStatus,
      },
    });
  }

  const input = parsed.data;
  const peopleIds = [...new Set(input.peopleIds)];
  const tags = [...new Set(input.tags)];
  let approvedPeopleIds: string[] = [];

  if (peopleIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", peopleIds)
      .eq("status", "approved");
    if (profilesError) {
      return Response.json({ error: "人物信息读取失败。" }, { status: 500 });
    }
    approvedPeopleIds = (profiles ?? []).map((profile) => String(profile.id));
  }

  const tagIds: string[] = [];
  for (const name of tags) {
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .upsert({ name }, { onConflict: "name" })
      .select("id")
      .single();
    if (tagError || !tag) {
      return Response.json({ error: "标签保存失败。" }, { status: 500 });
    }
    tagIds.push(String(tag.id));
  }

  const reviewStatus =
    owned.review_status === "hidden" ? "hidden" : "published";
  const { data: protectedMedia, error: protectError } = await supabase
    .from("photos")
    .update({
      review_status: "hidden",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .neq("review_status", "deleted")
    .select("id")
    .maybeSingle();
  if (protectError) {
    return Response.json({ error: "媒体资料保存失败。" }, { status: 500 });
  }
  if (!protectedMedia) return notFoundResponse();

  const { error: clearPeopleError } = await supabase
    .from("photo_people")
    .delete()
    .eq("photo_id", id);
  if (clearPeopleError) {
    return Response.json({ error: "人物关联更新失败。" }, { status: 500 });
  }
  if (approvedPeopleIds.length > 0) {
    const { error: peopleError } = await supabase.from("photo_people").insert(
      approvedPeopleIds.map((userId) => ({
        photo_id: id,
        user_id: userId,
        consent_status: "approved",
      })),
    );
    if (peopleError) {
      return Response.json({ error: "人物关联更新失败。" }, { status: 500 });
    }
  }

  const { error: clearTagsError } = await supabase
    .from("photo_tags")
    .delete()
    .eq("photo_id", id);
  if (clearTagsError) {
    return Response.json({ error: "标签关联更新失败。" }, { status: 500 });
  }
  if (tagIds.length > 0) {
    const { error: photoTagsError } = await supabase.from("photo_tags").insert(
      tagIds.map((tagId) => ({ photo_id: id, tag_id: tagId })),
    );
    if (photoTagsError) {
      return Response.json({ error: "标签关联更新失败。" }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("photos")
    .update({
      title: input.title,
      description: input.description,
      location: input.location,
      visibility: input.visibility,
      download_allowed: input.downloadAllowed,
      review_status: reviewStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .neq("review_status", "deleted")
    .select("id,review_status")
    .maybeSingle();
  if (updateError) {
    return Response.json({ error: "媒体资料保存失败。" }, { status: 500 });
  }
  if (!updated) return notFoundResponse();

  return Response.json({
    ok: true,
    photo: {
      id,
      title: input.title,
      description: input.description,
      location: input.location,
      visibility: input.visibility,
      downloadAllowed: input.downloadAllowed,
      reviewStatus,
      tags,
      peopleIds: approvedPeopleIds,
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getApiMember();
  if (!user) {
    return Response.json(
      { error: "请先以已通过审核的班级成员身份登录。" },
      { status: 401 },
    );
  }

  const id = (await params).id;
  if (DEMO_MODE) {
    const owned = MOCK_PHOTOS.find(
      (photo) =>
        photo.id === id &&
        photo.uploadedBy === user.id &&
        photo.reviewStatus !== "deleted",
    );
    if (!owned) return notFoundResponse();
    return Response.json({
      ok: true,
      message: "演示模式已模拟永久删除，不会修改云端数据。",
    });
  }

  const supabase = await createSupabaseAdminClient();
  const { data: owned, error: ownerError } = await supabase
    .from("photos")
    .select("id,original_key,preview_key,thumbnail_key")
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .neq("review_status", "deleted")
    .maybeSingle();
  if (ownerError) {
    return Response.json({ error: "读取媒体资料失败。" }, { status: 500 });
  }
  if (!owned) return notFoundResponse();

  const { data: deleted, error: deleteError } = await supabase
    .from("photos")
    .update({
      review_status: "deleted",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .neq("review_status", "deleted")
    .select("id")
    .maybeSingle();
  if (deleteError) {
    return Response.json({ error: "媒体删除失败。" }, { status: 500 });
  }
  if (!deleted) return notFoundResponse();

  try {
    await getStorageAdapter().deleteObjects([
      String(owned.original_key),
      String(owned.preview_key),
      String(owned.thumbnail_key),
    ]);
  } catch (error) {
    console.error("owner_media_storage_cleanup_failed", {
      mediaId: id,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({
      ok: true,
      storageCleanupPending: true,
      message: "内容已从相册永久移除，云端文件仍在清理中。",
    });
  }

  return Response.json({
    ok: true,
    message: "内容及其云端文件已永久删除。",
  });
}
