import { describe, expect, it } from "vitest";
import { canAccessMemberArea, canManageSite, canViewPhoto, filterVisiblePhotos } from "@/lib/authz";
import { toggleFavoriteIds } from "@/lib/favorites";
import { DEMO_MODE, getMissingProductionEnv, shouldUseDemoMode } from "@/lib/config";
import { evaluateInvite } from "@/lib/invites";
import { filterPhotos } from "@/lib/photo-filter";
import { chooseRandomId, pushRecentId } from "@/lib/random";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { hashInviteCode, signToken, verifyToken } from "@/lib/security/tokens";
import type { InviteCodeRecord, Photo, Profile } from "@/types/domain";

const member: Profile = { id: "member", email: "m@example.com", displayName: "同学", avatarKey: null, role: "member", status: "approved", showRealName: true, allowOriginalDownload: true, createdAt: "2026-01-01" };
const admin: Profile = { ...member, id: "admin", role: "admin" };
const pending: Profile = { ...member, id: "pending", status: "pending" };
const basePhoto: Photo = { id: "photo", title: "操场合照", description: "运动会", originalKey: "originals/photo/x.jpg", previewKey: "previews/photo.webp", thumbnailKey: "thumbnails/photo.webp", mediaType: "photo", mediaUrl: "/preview", previewUrl: "/preview", thumbnailUrl: "/thumb", width: 1200, height: 900, location: "操场", people: [], tags: ["操场", "运动会"], visibility: "class", selectedUserIds: [], downloadAllowed: true, reviewStatus: "published", uploadedBy: "admin", createdAt: "2026-01-01" };

describe("member and photo authorization", () => {
  it("blocks pending users and keeps admin access separate", () => {
    expect(canAccessMemberArea(pending)).toBe(false);
    expect(canManageSite(member)).toBe(false);
    expect(canManageSite(admin)).toBe(true);
  });

  it("enforces all four photo visibility modes", () => {
    expect(canViewPhoto(member, basePhoto)).toBe(true);
    expect(canViewPhoto(member, { ...basePhoto, visibility: "tagged_people", people: [{ id: member.id, name: "同学", consentStatus: "approved" }] })).toBe(true);
    expect(canViewPhoto(member, { ...basePhoto, visibility: "tagged_people" })).toBe(false);
    expect(canViewPhoto(member, { ...basePhoto, visibility: "selected", selectedUserIds: [member.id] })).toBe(true);
    expect(canViewPhoto(member, { ...basePhoto, visibility: "selected" })).toBe(false);
    expect(canViewPhoto(member, { ...basePhoto, visibility: "private" })).toBe(false);
    expect(canViewPhoto(admin, { ...basePhoto, visibility: "private" })).toBe(true);
  });

  it("never lets a rejected tagged photo leak into lists or random pools", () => {
    const rejected = { ...basePhoto, id: "rejected", people: [{ id: "other", name: "其他同学", consentStatus: "rejected" as const }] };
    const visible = filterVisiblePhotos(member, [basePhoto, rejected]);
    expect(visible.map((photo) => photo.id)).toEqual(["photo"]);
    expect(chooseRandomId(visible.map((photo) => photo.id), [], () => 0)).toBe("photo");
  });
});

describe("invite security", () => {
  const invite: InviteCodeRecord = { id: "invite", codeHash: "hash", expiresAt: "2099-01-01T00:00:00.000Z", maxUses: 10, usedCount: 1, revokedAt: null, createdBy: "admin", createdAt: "2026-01-01" };
  it("recognizes valid, expired, revoked and exhausted invites", () => {
    expect(evaluateInvite(invite).valid).toBe(true);
    expect(evaluateInvite({ ...invite, expiresAt: "2020-01-01" })).toEqual({ valid: false, reason: "expired" });
    expect(evaluateInvite({ ...invite, revokedAt: "2026-01-02" })).toEqual({ valid: false, reason: "revoked" });
    expect(evaluateInvite({ ...invite, usedCount: 10 })).toEqual({ valid: false, reason: "exhausted" });
  });
  it("hashes codes and rejects modified signed tokens", () => {
    expect(hashInviteCode(" class-1 ")).toBe(hashInviteCode("CLASS-1"));
    const token = signToken({ userId: "member" }, Date.now() + 10000);
    expect(verifyToken<{ userId: string }>(token)?.userId).toBe("member");
    expect(verifyToken(`${token}x`)).toBeNull();
  });
  it("limits repeated invite attempts", () => {
    resetRateLimit("test");
    expect(checkRateLimit("test", 2, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit("test", 2, 1000, 1).allowed).toBe(true);
    expect(checkRateLimit("test", 2, 1000, 2).allowed).toBe(false);
    resetRateLimit("test");
  });
});

describe("photo interactions", () => {
  it("searches titles, people, places and tags", () => {
    const withPerson = { ...basePhoto, people: [{ id: "x", name: "夏宁", consentStatus: "approved" as const }] };
    expect(filterPhotos([withPerson], "夏宁", "全部")).toHaveLength(1);
    expect(filterPhotos([withPerson], "操场", "运动会")).toHaveLength(1);
    expect(filterPhotos([withPerson], "食堂", "全部")).toHaveLength(0);
  });
  it("toggles favorites deterministically", () => {
    expect(toggleFavoriteIds([], "photo")).toEqual(["photo"]);
    expect(toggleFavoriteIds(["photo"], "photo")).toEqual([]);
  });
  it("avoids recent random memories until the pool is exhausted", () => {
    expect(chooseRandomId(["a", "b", "c"], ["a", "b"], () => 0)).toBe("c");
    expect(pushRecentId(["b", "a"], "a", 2)).toEqual(["a", "b"]);
  });
});

describe("credential-free development", () => {
  it("stays in demo mode and reports missing cloud configuration", () => {
    expect(DEMO_MODE).toBe(true);
    expect(getMissingProductionEnv()).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(getMissingProductionEnv()).toContain("R2_SECRET_ACCESS_KEY");
  });

  it("never falls back to demo data in production", () => {
    expect(shouldUseDemoMode({ NODE_ENV: "production" })).toBe(false);
    expect(shouldUseDemoMode({ NODE_ENV: "development" })).toBe(true);
  });
});
