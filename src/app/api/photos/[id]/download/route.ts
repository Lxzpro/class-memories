import { getCurrentUser } from "@/lib/auth";
import { canDownloadOriginal } from "@/lib/authz";
import { mediaExtensionFromObjectKey } from "@/lib/media";
import { getVisiblePhoto } from "@/lib/photos";
import { getStorageAdapter } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); const photo = user ? await getVisiblePhoto(user, (await params).id) : null;
  if (!photo || !canDownloadOriginal(user, photo)) return Response.json({ error: "无权下载这份原始文件。" }, { status: 403 });
  const extension = mediaExtensionFromObjectKey(photo.originalKey);
  const url = await getStorageAdapter().createReadUrl({ key: photo.originalKey, expiresIn: 60, downloadName: `${photo.title}.${extension}` });
  return Response.redirect(new URL(url, request.url));
}
