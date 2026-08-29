import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const reviewStatusSchema = z.enum(["draft", "published", "hidden"]);

const updateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(100).optional(),
  visibility: z
    .enum(["class", "tagged_people", "selected", "private"])
    .optional(),
  downloadAllowed: z.boolean().optional(),
  reviewStatus: reviewStatusSchema.optional(),
  peopleIds: z.array(z.string().min(1).max(80)).max(80).optional(),
  selectedUserIds: z.array(z.string().min(1).max(80)).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function notFoundResponse() {
  return Response.json({ error: "照片不存在。" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await getApiAdmin();
  if (!admin) {
    return Response.json({ error: "无权修改照片。" }, { status: 403 });
  }

  const id = (await params).id;
  const parsed = updateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "照片资料格式不正确。" }, { status: 400 });
  }

  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const input = parsed.data;
    const { data: current, error: currentError } = await supabase
      .from("photos")
      .select("id,review_status")
      .eq("id", id)
      .neq("review_status", "deleted")
      .maybeSingle();
    if (currentError) {
      return Response.json({ error: "读取照片资料失败。" }, { status: 500 });
    }
    if (!current) return notFoundResponse();

    const targetReviewStatus = reviewStatusSchema.safeParse(
      input.reviewStatus ?? current.review_status,
    );
    if (!targetReviewStatus.success) {
      return Response.json({ error: "照片状态不正确。" }, { status: 500 });
    }

    let approvedPeopleIds: string[] = [];
    if (input.peopleIds !== undefined && input.peopleIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id")
        .in("id", [...new Set(input.peopleIds)])
        .eq("status", "approved");
      if (profilesError) {
        return Response.json({ error: "人物信息读取失败。" }, { status: 500 });
      }
      approvedPeopleIds = (profiles ?? []).map((profile) => String(profile.id));
    }

    const tagIds: string[] = [];
    if (input.tags !== undefined) {
      for (const name of [...new Set(input.tags)]) {
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
    }

    const hasRelationChanges =
      input.peopleIds !== undefined ||
      input.selectedUserIds !== undefined ||
      input.tags !== undefined;

    if (hasRelationChanges) {
      const { data: protectedPhoto, error: protectError } = await supabase
        .from("photos")
        .update({
          review_status: "hidden",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .neq("review_status", "deleted")
        .select("id")
        .maybeSingle();
      if (protectError) {
        return Response.json({ error: "保存失败。" }, { status: 500 });
      }
      if (!protectedPhoto) return notFoundResponse();

      if (input.peopleIds !== undefined) {
        const { error: clearPeopleError } = await supabase
          .from("photo_people")
          .delete()
          .eq("photo_id", id);
        if (clearPeopleError) {
          return Response.json(
            { error: "人物关联更新失败。" },
            { status: 500 },
          );
        }
        if (approvedPeopleIds.length > 0) {
          const { error: peopleError } = await supabase
            .from("photo_people")
            .insert(
              approvedPeopleIds.map((userId) => ({
                photo_id: id,
                user_id: userId,
                consent_status: "approved",
              })),
            );
          if (peopleError) {
            return Response.json(
              { error: "人物关联更新失败。" },
              { status: 500 },
            );
          }
        }
      }

      if (input.selectedUserIds !== undefined) {
        const { error: clearAccessError } = await supabase
          .from("photo_access")
          .delete()
          .eq("photo_id", id);
        if (clearAccessError) {
          return Response.json(
            { error: "可见成员更新失败。" },
            { status: 500 },
          );
        }
        const selectedUserIds = [...new Set(input.selectedUserIds)];
        if (selectedUserIds.length > 0) {
          const { error: accessError } = await supabase
            .from("photo_access")
            .insert(
              selectedUserIds.map((userId) => ({
                photo_id: id,
                user_id: userId,
              })),
            );
          if (accessError) {
            return Response.json(
              { error: "可见成员更新失败。" },
              { status: 500 },
            );
          }
        }
      }

      if (input.tags !== undefined) {
        const { error: clearTagsError } = await supabase
          .from("photo_tags")
          .delete()
          .eq("photo_id", id);
        if (clearTagsError) {
          return Response.json(
            { error: "标签关联更新失败。" },
            { status: 500 },
          );
        }
        if (tagIds.length > 0) {
          const { error: photoTagsError } = await supabase
            .from("photo_tags")
            .insert(tagIds.map((tagId) => ({ photo_id: id, tag_id: tagId })));
          if (photoTagsError) {
            return Response.json(
              { error: "标签关联更新失败。" },
              { status: 500 },
            );
          }
        }
      }
    }

    const updateValues: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined) {
      updateValues.description = input.description;
    }
    if (input.location !== undefined) updateValues.location = input.location;
    if (input.visibility !== undefined) {
      updateValues.visibility = input.visibility;
    }
    if (input.downloadAllowed !== undefined) {
      updateValues.download_allowed = input.downloadAllowed;
    }
    if (input.reviewStatus !== undefined || hasRelationChanges) {
      updateValues.review_status = targetReviewStatus.data;
    }

    const { data: updated, error: updateError } = await supabase
      .from("photos")
      .update(updateValues)
      .eq("id", id)
      .neq("review_status", "deleted")
      .select("id")
      .maybeSingle();
    if (updateError) {
      return Response.json({ error: "保存失败。" }, { status: 500 });
    }
    if (!updated) return notFoundResponse();
  }

  await writeAdminLog(admin.id, "photo_updated", "photo", id, parsed.data);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const admin = await getApiAdmin();
  if (!admin) {
    return Response.json({ error: "无权删除照片。" }, { status: 403 });
  }

  const id = (await params).id;
  let storageCleanupPending = false;

  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const { data: photo, error: readError } = await supabase
      .from("photos")
      .select("id,original_key,preview_key,thumbnail_key")
      .eq("id", id)
      .neq("review_status", "deleted")
      .maybeSingle();
    if (readError) {
      return Response.json({ error: "读取照片资料失败。" }, { status: 500 });
    }
    if (!photo) return notFoundResponse();

    const { data: deleted, error: deleteError } = await supabase
      .from("photos")
      .update({
        review_status: "deleted",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .neq("review_status", "deleted")
      .select("id")
      .maybeSingle();
    if (deleteError) {
      return Response.json({ error: "照片删除失败。" }, { status: 500 });
    }
    if (!deleted) return notFoundResponse();

    const storageKeys = [
      photo.original_key,
      photo.preview_key,
      photo.thumbnail_key,
    ].filter(
      (key): key is string => typeof key === "string" && key.length > 0,
    );
    try {
      await getStorageAdapter().deleteObjects(storageKeys);
    } catch (error) {
      storageCleanupPending = true;
      console.error("admin_media_storage_cleanup_failed", {
        mediaId: id,
        reason: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  await writeAdminLog(admin.id, "photo_deleted", "photo", id);
  return Response.json(
    storageCleanupPending
      ? {
          ok: true,
          storageCleanupPending: true,
          message: "内容已从相册永久移除，云端文件仍在清理中。",
        }
      : { ok: true },
  );
}
