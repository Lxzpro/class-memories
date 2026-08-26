import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { getStorageAdapter } from "@/lib/storage";

const fileSchema = z.object({ name: z.string().min(1).max(180), type: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(25 * 1024 * 1024), previewSize: z.number().int().positive().max(8 * 1024 * 1024), thumbnailSize: z.number().int().positive().max(3 * 1024 * 1024) });

export async function POST(request: Request) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "仅管理员可以上传照片。" }, { status: 403 });
  const parsed = fileSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "仅支持 25MB 以内的 JPG、PNG 或 WebP 图片。" }, { status: 400 });
  const photoId = randomUUID(); const extension = parsed.data.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
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
