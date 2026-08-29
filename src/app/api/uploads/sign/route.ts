import { randomUUID } from "node:crypto";
import { getApiMember } from "@/lib/api-auth";
import {
  createMemberUploadKeys,
  memberUploadSignSchema,
} from "@/lib/member-uploads";
import { getStorageAdapter } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getApiMember();
  if (!user)
    return Response.json(
      { error: "只有已通过审核的班级成员可以上传照片或视频。" },
      { status: 401 },
    );

  const parsed = memberUploadSignSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: "支持 25MB 内的 JPG、PNG、WebP 图片，或 200MB 内的 MP4、WebM 视频。" },
      { status: 400 },
    );

  const photoId = randomUUID();
  const keys = createMemberUploadKeys(user.id, photoId, parsed.data.type);
  const storage = getStorageAdapter();
  const [originalUrl, previewUrl, thumbnailUrl] = await Promise.all([
    storage.createUploadUrl({
      key: keys.original,
      contentType: parsed.data.type,
      contentLength: parsed.data.size,
    }),
    storage.createUploadUrl({
      key: keys.preview,
      contentType: "image/webp",
      contentLength: parsed.data.previewSize,
    }),
    storage.createUploadUrl({
      key: keys.thumbnail,
      contentType: "image/webp",
      contentLength: parsed.data.thumbnailSize,
    }),
  ]);

  return Response.json({
    photoId,
    keys,
    urls: {
      original: originalUrl,
      preview: previewUrl,
      thumbnail: thumbnailUrl,
    },
  });
}
