import "server-only";

import { canViewPhoto, filterVisiblePhotos } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { mediaTypeFromObjectKey } from "@/lib/media";
import { MOCK_COMMENTS, MOCK_PHOTOS, MOCK_PROFILES } from "@/lib/mock-data";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { Photo, PhotoComment, PhotoVisibility, Profile, ReviewStatus } from "@/types/domain";

type RelatedRow = Record<string, unknown>;

function mapPhoto(row: RelatedRow, names: Map<string, string> = new Map()): Photo {
  const peopleRows = Array.isArray(row.photo_people) ? row.photo_people as RelatedRow[] : [];
  const accessRows = Array.isArray(row.photo_access) ? row.photo_access as RelatedRow[] : [];
  const tagRows = Array.isArray(row.photo_tags) ? row.photo_tags as RelatedRow[] : [];
  const originalKey = String(row.original_key);
  const uploadedBy = String(row.uploaded_by);
  return {
    id: String(row.id), title: String(row.title ?? "未命名回忆"), description: String(row.description ?? ""),
    originalKey, previewKey: String(row.preview_key), thumbnailKey: String(row.thumbnail_key),
    mediaType: mediaTypeFromObjectKey(originalKey), mediaUrl: "", previewUrl: "", thumbnailUrl: "", width: Number(row.width ?? 1200), height: Number(row.height ?? 900),
    location: String(row.location ?? ""),
    people: peopleRows.map((item) => {
      const profile = item.profiles as RelatedRow | null;
      return { id: String(item.user_id), name: String(profile?.display_name ?? names.get(String(item.user_id)) ?? "班级成员"), consentStatus: item.consent_status === "rejected" ? "rejected" : item.consent_status === "pending" ? "pending" : "approved" };
    }),
    tags: tagRows.map((item) => String((item.tags as RelatedRow | null)?.name ?? "")).filter(Boolean),
    visibility: String(row.visibility) as PhotoVisibility,
    selectedUserIds: accessRows.map((item) => String(item.user_id)),
    downloadAllowed: Boolean(row.download_allowed), reviewStatus: String(row.review_status) as ReviewStatus,
    uploadedBy, uploaderName: names.get(uploadedBy) ?? "班级成员", createdAt: String(row.created_at),
  };
}

async function signPhoto(photo: Photo): Promise<Photo> {
  const storage = getStorageAdapter();
  const [thumbnailUrl, previewUrl, videoUrl] = await Promise.all([
    storage.createReadUrl({ key: photo.thumbnailKey, expiresIn: 5 * 60 }),
    storage.createReadUrl({ key: photo.previewKey, expiresIn: 5 * 60 }),
    photo.mediaType === "video"
      ? storage.createReadUrl({ key: photo.originalKey, expiresIn: 5 * 60 })
      : Promise.resolve(""),
  ]);
  return { ...photo, thumbnailUrl, previewUrl, mediaUrl: videoUrl || previewUrl };
}

export type UploadMemberOption = { id: string; name: string };

export async function getUploadMemberOptions(): Promise<UploadMemberOption[]> {
  if (DEMO_MODE) return MOCK_PROFILES.filter((profile) => profile.status === "approved").map((profile) => ({ id: profile.id, name: profile.displayName }));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("member_directory").select("id,display_name").order("display_name");
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.display_name) }));
}

function applyDemoDownloadConsent(user: Profile, photos: Photo[]): Photo[] {
  if (user.role === "admin" || photos.length === 0) return photos;
  const profiles = new Map(MOCK_PROFILES.map((profile) => [profile.id, profile]));
  return photos.map((photo) => ({
    ...photo,
    downloadAllowed:
      photo.uploadedBy === user.id ||
      (photo.downloadAllowed &&
        photo.people.every(
          (person) =>
            profiles.get(person.id)?.allowOriginalDownload !== false,
        )),
  }));
}

async function getBlockedDownloadPhotoIds(user: Profile, photoIds?: string[]): Promise<Set<string>> {
  if (user.role === "admin" || photoIds?.length === 0) return new Set();
  const admin = await createSupabaseAdminClient();
  const query = admin.from("photo_people").select("photo_id,profiles(allow_original_download)");
  const { data } = photoIds ? await query.in("photo_id", photoIds) : await query;
  return new Set((data ?? []).filter((row) => {
    const related = row.profiles as unknown as { allow_original_download?: boolean } | Array<{ allow_original_download?: boolean }> | null;
    const profile = Array.isArray(related) ? related[0] : related;
    return profile?.allow_original_download === false;
  }).map((row) => String(row.photo_id)));
}

function applyDownloadConsent(user: Profile, photos: Photo[], blockedPhotoIds: Set<string>): Photo[] {
  if (user.role === "admin" || photos.length === 0) return photos;
  return photos.map((photo) => ({
    ...photo,
    downloadAllowed:
      photo.uploadedBy === user.id ||
      (photo.downloadAllowed && !blockedPhotoIds.has(photo.id)),
  }));
}

async function getVisibleMedia(user: Profile, mediaType?: "video"): Promise<Photo[]> {
  if (DEMO_MODE) {
    const visible = filterVisiblePhotos(user, MOCK_PHOTOS);
    return applyDemoDownloadConsent(user, mediaType ? visible.filter((photo) => photo.mediaType === mediaType) : visible);
  }
  const supabase = await createSupabaseServerClient();
  let photosQuery = supabase.from("photos").select("*, photo_people(user_id, consent_status), photo_access(user_id), photo_tags(tags(name))").eq("review_status", "published");
  if (mediaType === "video") {
    photosQuery = photosQuery.or("original_key.ilike.%.mp4,original_key.ilike.%.webm");
  }
  const [{ data, error }, { data: directory }, blockedPhotoIds] = await Promise.all([
    photosQuery.order("created_at", { ascending: false }),
    supabase.from("member_directory").select("id,display_name"),
    getBlockedDownloadPhotoIds(user),
  ]);
  if (error) throw new Error("无法读取照片列表");
  const names = new Map((directory ?? []).map((row) => [String(row.id), String(row.display_name)]));
  const photos = applyDownloadConsent(user, (data ?? []).map((row) => mapPhoto(row as RelatedRow, names)), blockedPhotoIds);
  return Promise.all(photos.map(signPhoto));
}

export function getVisiblePhotos(user: Profile): Promise<Photo[]> {
  return getVisibleMedia(user);
}

export function getVisibleVideos(user: Profile): Promise<Photo[]> {
  return getVisibleMedia(user, "video");
}

export async function getOwnedMedia(user: Profile): Promise<Photo[]> {
  if (DEMO_MODE) {
    return MOCK_PHOTOS.filter(
      (photo) =>
        photo.uploadedBy === user.id && photo.reviewStatus !== "deleted",
    );
  }

  const admin = await createSupabaseAdminClient();
  const [{ data, error }, { data: profiles }] = await Promise.all([
    admin
      .from("photos")
      .select(
        "*, photo_people(user_id, consent_status), photo_access(user_id), photo_tags(tags(name))",
      )
      .eq("uploaded_by", user.id)
      .neq("review_status", "deleted")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id,display_name,show_real_name")
      .eq("status", "approved"),
  ]);
  if (error) throw new Error("无法读取你上传的媒体");

  const names = new Map(
    (profiles ?? []).map((profile) => [
      String(profile.id),
      profile.show_real_name
        ? String(profile.display_name)
        : "匿名同学",
    ]),
  );
  return Promise.all(
    (data ?? []).map((row) => signPhoto(mapPhoto(row as RelatedRow, names))),
  );
}

export async function getVisiblePhoto(user: Profile, id: string): Promise<Photo | null> {
  if (DEMO_MODE) {
    const photo = MOCK_PHOTOS.find((item) => item.id === id) ?? null;
    if (!photo || !canViewPhoto(user, photo)) return null;
    return applyDemoDownloadConsent(user, [photo])[0];
  }
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: directory }, blockedPhotoIds] = await Promise.all([
    supabase.from("photos").select("*, photo_people(user_id, consent_status), photo_access(user_id), photo_tags(tags(name))").eq("id", id).maybeSingle(),
    supabase.from("member_directory").select("id,display_name"),
    getBlockedDownloadPhotoIds(user, [id]),
  ]);
  const names = new Map((directory ?? []).map((row) => [String(row.id), String(row.display_name)]));
  if (!data) return null;
  const [photo] = applyDownloadConsent(user, [mapPhoto(data as RelatedRow, names)], blockedPhotoIds);
  return signPhoto(photo);
}

export async function getFavoritePhotoIds(user: Profile): Promise<string[]> {
  if (DEMO_MODE) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("favorites").select("photo_id").eq("user_id", user.id);
  if (error) return [];
  return (data ?? []).map((row) => String(row.photo_id));
}

export async function getPhotoComments(user: Profile, photoId: string): Promise<PhotoComment[]> {
  if (DEMO_MODE) {
    const photo = MOCK_PHOTOS.find((item) => item.id === photoId);
    if (!photo || !canViewPhoto(user, photo)) return [];
    return MOCK_COMMENTS.filter((comment) => comment.photoId === photoId && comment.status === "visible");
  }
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: directory }] = await Promise.all([
    supabase.from("comments").select("id, photo_id, user_id, content, status, created_at").eq("photo_id", photoId).eq("status", "visible").order("created_at"),
    supabase.from("member_directory").select("id,display_name"),
  ]);
  const names = new Map((directory ?? []).map((row) => [String(row.id), String(row.display_name)]));
  return (data ?? []).map((row) => ({
    id: String(row.id), photoId: String(row.photo_id), userId: String(row.user_id),
    authorName: names.get(String(row.user_id)) ?? "班级成员",
    content: String(row.content), status: "visible", createdAt: String(row.created_at),
  }));
}
