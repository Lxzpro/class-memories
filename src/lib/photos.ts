import "server-only";

import { canViewPhoto, filterVisiblePhotos } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { MOCK_COMMENTS, MOCK_PHOTOS, MOCK_PROFILES } from "@/lib/mock-data";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { Photo, PhotoComment, PhotoVisibility, Profile, ReviewStatus } from "@/types/domain";

type RelatedRow = Record<string, unknown>;

function mapPhoto(row: RelatedRow, names: Map<string, string> = new Map()): Photo {
  const peopleRows = Array.isArray(row.photo_people) ? row.photo_people as RelatedRow[] : [];
  const accessRows = Array.isArray(row.photo_access) ? row.photo_access as RelatedRow[] : [];
  const tagRows = Array.isArray(row.photo_tags) ? row.photo_tags as RelatedRow[] : [];
  return {
    id: String(row.id), title: String(row.title ?? "未命名回忆"), description: String(row.description ?? ""),
    originalKey: String(row.original_key), previewKey: String(row.preview_key), thumbnailKey: String(row.thumbnail_key),
    previewUrl: "", thumbnailUrl: "", width: Number(row.width ?? 1200), height: Number(row.height ?? 900),
    location: String(row.location ?? ""),
    people: peopleRows.map((item) => {
      const profile = item.profiles as RelatedRow | null;
      return { id: String(item.user_id), name: String(profile?.display_name ?? names.get(String(item.user_id)) ?? "班级成员"), consentStatus: item.consent_status === "rejected" ? "rejected" : item.consent_status === "pending" ? "pending" : "approved" };
    }),
    tags: tagRows.map((item) => String((item.tags as RelatedRow | null)?.name ?? "")).filter(Boolean),
    visibility: String(row.visibility) as PhotoVisibility,
    selectedUserIds: accessRows.map((item) => String(item.user_id)),
    downloadAllowed: Boolean(row.download_allowed), reviewStatus: String(row.review_status) as ReviewStatus,
    uploadedBy: String(row.uploaded_by), createdAt: String(row.created_at),
  };
}

async function signPhoto(photo: Photo): Promise<Photo> {
  const storage = getStorageAdapter();
  const [thumbnailUrl, previewUrl] = await Promise.all([
    storage.createReadUrl({ key: photo.thumbnailKey, expiresIn: 5 * 60 }),
    storage.createReadUrl({ key: photo.previewKey, expiresIn: 5 * 60 }),
  ]);
  return { ...photo, thumbnailUrl, previewUrl };
}

function applyDemoDownloadConsent(user: Profile, photos: Photo[]): Photo[] {
  if (user.role === "admin" || photos.length === 0) return photos;
  const profiles = new Map(MOCK_PROFILES.map((profile) => [profile.id, profile]));
  return photos.map((photo) => ({ ...photo, downloadAllowed: photo.downloadAllowed && photo.people.every((person) => profiles.get(person.id)?.allowOriginalDownload !== false) }));
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
  return photos.map((photo) => ({ ...photo, downloadAllowed: photo.downloadAllowed && !blockedPhotoIds.has(photo.id) }));
}

export async function getVisiblePhotos(user: Profile): Promise<Photo[]> {
  if (DEMO_MODE) return applyDemoDownloadConsent(user, filterVisiblePhotos(user, MOCK_PHOTOS));
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: directory }, blockedPhotoIds] = await Promise.all([
    supabase.from("photos").select("*, photo_people(user_id, consent_status), photo_access(user_id), photo_tags(tags(name))").eq("review_status", "published").order("created_at", { ascending: false }),
    supabase.from("member_directory").select("id,display_name"),
    getBlockedDownloadPhotoIds(user),
  ]);
  if (error) throw new Error("无法读取照片列表");
  const names = new Map((directory ?? []).map((row) => [String(row.id), String(row.display_name)]));
  const photos = applyDownloadConsent(user, (data ?? []).map((row) => mapPhoto(row as RelatedRow, names)), blockedPhotoIds);
  return Promise.all(photos.map(signPhoto));
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

export async function getPendingTagRequests(user: Profile): Promise<Photo[]> {
  if (DEMO_MODE) return MOCK_PHOTOS.filter((photo) => photo.people.some((person) => person.id === user.id && person.consentStatus === "pending"));
  const admin = await createSupabaseAdminClient();
  const { data } = await admin.from("photo_people").select("photos(*)").eq("user_id", user.id).eq("consent_status", "pending");
  const rows = (data ?? []).map((item) => item.photos).filter(Boolean) as unknown as RelatedRow[];
  return Promise.all(rows.map((row) => signPhoto(mapPhoto(row))));
}
