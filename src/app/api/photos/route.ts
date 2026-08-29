import { getApiMember } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import {
  memberPhotoSubmissionSchema,
  submissionKeysBelongToUser,
} from "@/lib/member-uploads";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getApiMember();
  if (!user)
    return Response.json(
      { error: "只有已通过审核的班级成员可以提交照片或视频。" },
      { status: 401 },
    );

  const parsed = memberPhotoSubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: "媒体资料不完整，请检查标题、文件和人物信息。" },
      { status: 400 },
    );
  if (!submissionKeysBelongToUser(user.id, parsed.data)) {
    return Response.json(
      { error: "媒体存储路径与当前账号不匹配。" },
      { status: 403 },
    );
  }

  const photo = parsed.data;
  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const storage = getStorageAdapter();
    const cleanupFailedUpload = async () => {
      const { data: removed } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id)
        .eq("uploaded_by", user.id)
        .eq("review_status", "draft")
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (!removed) return;
      await storage
        .deleteObjects([
          photo.originalKey,
          photo.previewKey,
          photo.thumbnailKey,
        ])
        .catch(() => undefined);
    };
    const { error } = await supabase.from("photos").insert({
      id: photo.id,
      title: photo.title,
      description: photo.description,
      original_key: photo.originalKey,
      preview_key: photo.previewKey,
      thumbnail_key: photo.thumbnailKey,
      width: photo.width,
      height: photo.height,
      location: photo.location,
      visibility: photo.visibility,
      download_allowed: false,
      review_status: "draft",
      uploaded_by: user.id,
    });

    if (error) {
      return Response.json(
        {
          error:
            error.code === "23505"
              ? "这份媒体已经发布，请不要重复提交。"
              : "媒体资料保存失败，请重新上传。",
        },
        { status: error.code === "23505" ? 409 : 500 },
      );
    }

    if (photo.peopleIds.length > 0) {
      const uniquePeopleIds = [...new Set(photo.peopleIds)];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id")
        .in("id", uniquePeopleIds)
        .eq("status", "approved");
      if (profilesError) {
        await cleanupFailedUpload();
        return Response.json(
          { error: "人物信息读取失败，请重新上传。" },
          { status: 500 },
        );
      }
      const people = (profiles ?? []).map((profile) => ({
        photo_id: photo.id,
        user_id: profile.id,
        consent_status: "approved",
      }));
      if (people.length > 0) {
        const { error: peopleError } = await supabase.from("photo_people").insert(people);
        if (peopleError) {
          await cleanupFailedUpload();
          return Response.json({ error: "人物关联保存失败，请重新上传。" }, { status: 500 });
        }
      }
    }

    for (const name of photo.tags) {
      const { data: tag, error: tagError } = await supabase
        .from("tags")
        .upsert({ name }, { onConflict: "name" })
        .select("id")
        .single();
      if (tagError || !tag) {
        await cleanupFailedUpload();
        return Response.json({ error: "标签保存失败，请重新上传。" }, { status: 500 });
      }
      const { error: photoTagError } = await supabase
        .from("photo_tags")
        .upsert({ photo_id: photo.id, tag_id: tag.id });
      if (photoTagError) {
        await cleanupFailedUpload();
        return Response.json({ error: "标签关联保存失败，请重新上传。" }, { status: 500 });
      }
    }

    const { data: publishedPhoto, error: publishError } = await supabase
      .from("photos")
      .update({ review_status: "published" })
      .eq("id", photo.id)
      .eq("uploaded_by", user.id)
      .eq("review_status", "draft")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (publishError || !publishedPhoto) {
      await cleanupFailedUpload();
      return Response.json(
        {
          error: publishError
            ? "媒体发布失败，请重新上传。"
            : "媒体状态已发生变化，本次发布已取消。",
        },
        { status: publishError ? 500 : 409 },
      );
    }
  }

  return Response.json(
    {
      photo: {
        id: photo.id,
        title: photo.title,
        reviewStatus: "published",
        createdAt: new Date().toISOString(),
      },
      message: DEMO_MODE
        ? "演示模式已模拟发布，媒体不会写入云端。"
        : `${photo.mediaType === "video" ? "视频" : "照片"}已发布，可以立即在班级相册中查看。`,
    },
    { status: 201 },
  );
}
