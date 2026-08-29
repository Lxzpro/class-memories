import { randomUUID } from "node:crypto";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import {
  MAX_IMAGE_FILE_SIZE_MB,
  MAX_VIDEO_FILE_SIZE_MB,
} from "@/lib/media-limits";
import { memberUploadSignSchema } from "@/lib/member-uploads";
import { getStorageAdapter } from "@/lib/storage";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" };

export async function POST(request: Request) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "仅管理员可以上传照片或视频。" }, { status: 403 });
  const parsed = memberUploadSignSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: `支持 ${MAX_IMAGE_FILE_SIZE_MB}MB 内的图片，或 ${MAX_VIDEO_FILE_SIZE_MB}MB 内的 MP4、WebM 视频。` }, { status: 400 });
  const photoId = randomUUID(); const extension = extensions[parsed.data.type];
  const keys = { original: `originals/${photoId}/memory.${extension}`, preview: `previews/${photoId}.webp`, thumbnail: `thumbnails/${photoId}.webp` };
  const storage = getStorageAdapter();
  const [originalUrl, previewUrl, thumbnailUrl] = await Promise.all([
    storage.createUploadUrl({ key: keys.original, contentType: parsed.data.type, contentLength: parsed.data.size }),
    storage.createUploadUrl({ key: keys.preview, contentType: "image/webp", contentLength: parsed.data.previewSize }),
    storage.createUploadUrl({ key: keys.thumbnail, contentType: "image/webp", contentLength: parsed.data.thumbnailSize }),
  ]);
  await writeAdminLog(admin.id, "upload_urls_created", "photo", photoId, { keys });
  return Response.json({ photoId, keys, urls: { original: originalUrl, preview: previewUrl, thumbnail: thumbnailUrl } });
}
