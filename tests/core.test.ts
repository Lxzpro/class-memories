import { describe, expect, it } from "vitest";
import { canAccessMemberArea, canManageSite, canViewPhoto, filterVisiblePhotos } from "@/lib/authz";
import { toggleFavoriteIds } from "@/lib/favorites";
import { DEMO_MODE, getMissingProductionEnv, shouldUseDemoMode } from "@/lib/config";
import {
  ALL_UPLOADERS,
  MY_UPLOADS,
  filterPhotos,
  summarizeUploaders,
} from "@/lib/photo-filter";
import { chooseRandomId, pushRecentId } from "@/lib/random";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { signToken, verifyToken } from "@/lib/security/tokens";
import type { Photo, Profile } from "@/types/domain";

const member: Profile = { id: "member", email: "m@example.com", displayName: "同学", realName: "李同学", avatarKey: null, role: "member", status: "approved", showRealName: true, allowOriginalDownload: true, createdAt: "2026-01-01" };
const admin: Profile = { ...member, id: "admin", role: "admin" };
const pending: Profile = { ...member, id: "pending", status: "pending" };
const basePhoto: Photo = { id: "photo", title: "操场合照", description: "运动会", originalKey: "originals/photo/x.jpg", previewKey: "previews/photo.webp", thumbnailKey: "thumbnails/photo.webp", mediaType: "photo", mediaUrl: "/preview", previewUrl: "/preview", thumbnailUrl: "/thumb", width: 1200, height: 900, location: "操场", people: [], tags: ["操场", "运动会"], visibility: "class", selectedUserIds: [], downloadAllowed: true, reviewStatus: "published", uploadedBy: "admin", uploaderName: "管理员", uploaderRole: "admin", createdAt: "2026-01-01" };

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

describe("authentication security", () => {
  it("rejects modified signed tokens", () => {
    const token = signToken({ userId: "member" }, Date.now() + 10000);
    expect(verifyToken<{ userId: string }>(token)?.userId).toBe("member");
    expect(verifyToken(`${token}x`)).toBeNull();
  });
  it("limits repeated authentication attempts", () => {
    resetRateLimit("auth-test");
    expect(checkRateLimit("auth-test", 2, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit("auth-test", 2, 1000, 1).allowed).toBe(true);
    expect(checkRateLimit("auth-test", 2, 1000, 2).allowed).toBe(false);
    resetRateLimit("auth-test");
  });
});

describe("photo interactions", () => {
  it("searches titles, people, places and tags", () => {
    const withPerson = { ...basePhoto, people: [{ id: "x", name: "夏宁", consentStatus: "approved" as const }] };
    expect(filterPhotos([withPerson], "夏宁", ALL_UPLOADERS)).toHaveLength(1);
    expect(filterPhotos([withPerson], "运动会", ALL_UPLOADERS)).toHaveLength(1);
    expect(filterPhotos([withPerson], "食堂", ALL_UPLOADERS)).toHaveLength(0);
  });
  it("filters by the current uploader and groups admin uploads as class archive", () => {
    const memberPhoto = {
      ...basePhoto,
      id: "member-photo",
      uploadedBy: member.id,
      uploaderName: "同学",
      uploaderRole: "member" as const,
      createdAt: "2026-02-01",
    };
    const secondAdminPhoto = {
      ...basePhoto,
      id: "second-admin-photo",
      uploadedBy: "another-admin",
      createdAt: "2026-03-01",
    };
    expect(
      filterPhotos([basePhoto, memberPhoto], "", MY_UPLOADS, member.id),
    ).toEqual([memberPhoto]);
    expect(summarizeUploaders([basePhoto, memberPhoto, secondAdminPhoto])).toEqual([
      expect.objectContaining({
        id: "class-archive",
        name: "班级资料",
        count: 2,
        isClassArchive: true,
      }),
      expect.objectContaining({ id: member.id, name: "同学", count: 1 }),
    ]);
  });
  it("keeps each admin photo's actual uploader name while merging its filter summary", () => {
    const firstAdminPhoto = {
      ...basePhoto,
      uploaderName: "王老师",
    };
    const secondAdminPhoto = {
      ...basePhoto,
      id: "second-admin-photo",
      uploadedBy: "another-admin",
      uploaderName: "李老师",
      createdAt: "2026-03-01",
    };

    expect(summarizeUploaders([firstAdminPhoto, secondAdminPhoto])).toEqual([
      expect.objectContaining({
        id: "class-archive",
        name: "班级资料",
        count: 2,
        isClassArchive: true,
      }),
    ]);
    expect(firstAdminPhoto.uploaderName).toBe("王老师");
    expect(secondAdminPhoto.uploaderName).toBe("李老师");
    expect(
      filterPhotos(
        [firstAdminPhoto, secondAdminPhoto],
        "王老师",
        "uploader:class-archive",
      ),
    ).toEqual([firstAdminPhoto]);
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
