import "server-only";

import { DEMO_MODE } from "@/lib/config";
import { mediaTypeFromObjectKey } from "@/lib/media";
import { MOCK_PHOTOS, MOCK_PROFILES } from "@/lib/mock-data";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Photo, PrivacyRequest, Profile } from "@/types/domain";

export interface AdminInviteView { id: string; expiresAt: string; maxUses: number; usedCount: number; revokedAt: string | null; createdAt: string; redemptions: Array<{ name: string; redeemedAt: string }> }
export interface AdminLogView { id: string; action: string; resourceType: string; createdAt: string; adminName: string }
export interface AdminDashboardData { photos: Photo[]; members: Profile[]; invites: AdminInviteView[]; logs: AdminLogView[]; privacyRequests: PrivacyRequest[] }

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  if (DEMO_MODE) return {
    photos: MOCK_PHOTOS,
    members: MOCK_PROFILES,
    invites: [
      { id: "invite-active", expiresAt: "2026-09-10T23:59:59.000Z", maxUses: 50, usedCount: 8, revokedAt: null, createdAt: "2026-08-18T08:00:00.000Z", redemptions: [{ name: "夏宁", redeemedAt: "2026-08-20T09:10:00.000Z" }, { name: "周予安", redeemedAt: "2026-08-21T12:30:00.000Z" }] },
      { id: "invite-revoked", expiresAt: "2026-09-01T23:59:59.000Z", maxUses: 10, usedCount: 3, revokedAt: "2026-08-23T10:00:00.000Z", createdAt: "2026-08-10T08:00:00.000Z", redemptions: [{ name: "林澈", redeemedAt: "2026-08-12T10:00:00.000Z" }] },
    ],
    logs: [
      { id: "log-1", action: "上传并发布了 12 张照片", resourceType: "照片", createdAt: "2026-08-25T10:20:00.000Z", adminName: "林老师" },
      { id: "log-2", action: "审核通过成员 夏宁", resourceType: "成员", createdAt: "2026-08-24T14:10:00.000Z", adminName: "林老师" },
      { id: "log-3", action: "创建了一个限时邀请", resourceType: "邀请", createdAt: "2026-08-23T08:40:00.000Z", adminName: "林老师" },
    ],
    privacyRequests: [
      { id: "privacy-demo-1", userId: "user-member", userName: "夏宁", photoId: "photo-4", photoTitle: "走廊尽头的午后", kind: "hide", message: "这张照片里有我，希望先不要对全班展示。", status: "pending", createdAt: "2026-08-25T15:30:00.000Z", resolvedAt: null },
    ],
  };

  const supabase = await createSupabaseAdminClient();
  const [{ data: photoRows }, { data: memberRows }, { data: inviteRows }, { data: logRows }, { data: privacyRows }] = await Promise.all([
    supabase.from("photos").select("*,photo_people(user_id,consent_status),photo_access(user_id),photo_tags(tags(name))").neq("review_status", "deleted").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("invite_codes").select("id,expires_at,max_uses,used_count,revoked_at,created_at,invite_redemptions(redeemed_at,status,profiles(display_name))").order("created_at", { ascending: false }),
    supabase.from("admin_logs").select("id,action,resource_type,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("privacy_requests").select("id,user_id,photo_id,kind,message,status,created_at,resolved_at,profiles(display_name),photos(title)").order("created_at", { ascending: false }),
  ]);
  const storage = getStorageAdapter();
  const memberNames = new Map((memberRows ?? []).map((row) => [String(row.id), String(row.display_name)]));
  const photos = await Promise.all((photoRows ?? []).map(async (row): Promise<Photo> => {
    const originalKey = String(row.original_key);
    const mediaType = mediaTypeFromObjectKey(originalKey);
    const [previewUrl, thumbnailUrl, videoUrl] = await Promise.all([
      storage.createReadUrl({ key: String(row.preview_key) }),
      storage.createReadUrl({ key: String(row.thumbnail_key) }),
      mediaType === "video" ? storage.createReadUrl({ key: originalKey }) : Promise.resolve(""),
    ]);
    const peopleRows = (row.photo_people ?? []) as unknown as Array<{ user_id: string; consent_status: string }>;
    const accessRows = (row.photo_access ?? []) as unknown as Array<{ user_id: string }>;
    const tagRows = (row.photo_tags ?? []) as unknown as Array<{ tags?: { name?: string } | null }>;
    return {
      id: String(row.id), title: String(row.title), description: String(row.description ?? ""), originalKey, previewKey: String(row.preview_key), thumbnailKey: String(row.thumbnail_key),
      mediaType, mediaUrl: videoUrl || previewUrl, previewUrl, thumbnailUrl, width: Number(row.width), height: Number(row.height), location: String(row.location ?? ""),
      people: peopleRows.map((person) => ({ id: String(person.user_id), name: memberNames.get(String(person.user_id)) ?? "班级成员", consentStatus: person.consent_status === "rejected" ? "rejected" : person.consent_status === "pending" ? "pending" : "approved" })),
      tags: tagRows.map((item) => String(item.tags?.name ?? "")).filter(Boolean), visibility: row.visibility, selectedUserIds: accessRows.map((item) => String(item.user_id)), downloadAllowed: Boolean(row.download_allowed), reviewStatus: row.review_status, uploadedBy: String(row.uploaded_by), createdAt: String(row.created_at),
    };
  }));
  const members: Profile[] = (memberRows ?? []).map((row) => ({ id: String(row.id), email: String(row.email), displayName: String(row.display_name), avatarKey: row.avatar_key ? String(row.avatar_key) : null, role: row.role, status: row.status, showRealName: Boolean(row.show_real_name), allowOriginalDownload: Boolean(row.allow_original_download), createdAt: String(row.created_at) }));
  const invites: AdminInviteView[] = (inviteRows ?? []).map((row) => ({ id: String(row.id), expiresAt: String(row.expires_at), maxUses: Number(row.max_uses), usedCount: Number(row.used_count), revokedAt: row.revoked_at ? String(row.revoked_at) : null, createdAt: String(row.created_at), redemptions: ((row.invite_redemptions ?? []) as unknown as Array<{ redeemed_at: string; profiles?: { display_name?: string } | null }>).map((item) => ({ name: item.profiles?.display_name ?? "班级成员", redeemedAt: item.redeemed_at })) }));
  const logs: AdminLogView[] = (logRows ?? []).map((row) => ({ id: String(row.id), action: String(row.action), resourceType: String(row.resource_type), createdAt: String(row.created_at), adminName: String((row.profiles as unknown as { display_name?: string } | null)?.display_name ?? "管理员") }));
  const privacyRequests: PrivacyRequest[] = (privacyRows ?? []).map((row) => ({
    id: String(row.id), userId: String(row.user_id), userName: String((row.profiles as unknown as { display_name?: string } | null)?.display_name ?? "班级成员"),
    photoId: row.photo_id ? String(row.photo_id) : null, photoTitle: String((row.photos as unknown as { title?: string } | null)?.title ?? "照片已删除"),
    kind: row.kind as PrivacyRequest["kind"], message: String(row.message ?? ""), status: row.status as PrivacyRequest["status"], createdAt: String(row.created_at), resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  }));
  return { photos, members, invites, logs, privacyRequests };
}
