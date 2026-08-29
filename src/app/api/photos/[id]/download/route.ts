import { getApiMember } from "@/lib/api-auth";
import { canDownloadOriginal } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { mediaExtensionFromObjectKey } from "@/lib/media";
import { MOCK_PHOTOS } from "@/lib/mock-data";
import { getVisiblePhoto } from "@/lib/photos";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiMember();
  if (!user) {
    return Response.json({ error: "无权下载这份原始文件。" }, { status: 403 });
  }

  const id = (await params).id;
  let media: {
    title: string;
    original_key: string;
    uploaded_by: string;
  } | null = null;
  if (DEMO_MODE) {
    const demoMedia = MOCK_PHOTOS.find(
      (item) => item.id === id && item.reviewStatus !== "deleted",
    );
    if (demoMedia) {
      media = {
        title: demoMedia.title,
        original_key: demoMedia.originalKey,
        uploaded_by: demoMedia.uploadedBy,
      };
    }
  } else {
    const supabase = await createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("photos")
      .select("title,original_key,uploaded_by")
      .eq("id", id)
      .neq("review_status", "deleted")
      .maybeSingle();
    if (error) {
      return Response.json({ error: "读取原始文件失败。" }, { status: 500 });
    }
    media = data;
  }

  let originalKey = "";
  let title = "";
  if (
    media &&
    (user.role === "admin" || String(media.uploaded_by) === user.id)
  ) {
    originalKey = String(media.original_key);
    title = String(media.title || "班级回忆");
  } else {
    const photo = await getVisiblePhoto(user, id);
    if (!photo || !canDownloadOriginal(user, photo)) {
      return Response.json({ error: "无权下载这份原始文件。" }, { status: 403 });
    }
    originalKey = photo.originalKey;
    title = photo.title;
  }

  const extension = mediaExtensionFromObjectKey(originalKey);
  const url = await getStorageAdapter().createReadUrl({
    key: originalKey,
    expiresIn: 60,
    downloadName: `${title}.${extension}`,
  });
  return Response.redirect(new URL(url, request.url));
}
