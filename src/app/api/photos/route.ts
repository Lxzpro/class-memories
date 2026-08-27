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
      { error: "只有已通过审核的班级成员可以提交照片。" },
      { status: 401 },
    );

  const parsed = memberPhotoSubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: "照片资料不完整，请检查标题和图片信息。" },
      { status: 400 },
    );
  if (!submissionKeysBelongToUser(user.id, parsed.data)) {
    return Response.json(
      { error: "照片存储路径与当前账号不匹配。" },
      { status: 403 },
    );
  }

  const photo = parsed.data;
  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
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
      await getStorageAdapter()
        .deleteObjects([
          photo.originalKey,
          photo.previewKey,
          photo.thumbnailKey,
        ])
        .catch(() => undefined);
      return Response.json(
        { error: "照片资料保存失败，请重新上传。" },
        { status: 500 },
      );
    }

    for (const name of photo.tags) {
      const { data: tag } = await supabase
        .from("tags")
        .upsert({ name }, { onConflict: "name" })
        .select("id")
        .single();
      if (tag)
        await supabase
          .from("photo_tags")
          .upsert({ photo_id: photo.id, tag_id: tag.id });
    }
  }

  return Response.json(
    {
      photo: {
        id: photo.id,
        title: photo.title,
        reviewStatus: "draft",
        createdAt: new Date().toISOString(),
      },
      message: DEMO_MODE
        ? "演示模式已模拟提交，照片不会写入云端。"
        : "照片已提交，管理员审核后会出现在相册中。",
    },
    { status: 201 },
  );
}
