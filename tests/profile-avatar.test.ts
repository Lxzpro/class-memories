import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  avatarKeyBelongsToUser,
  avatarUploadSignSchema,
  avatarVersion,
  createAvatarKey,
  qqAvatarUrl,
  qqNumberFromEmail,
} from "@/lib/profile-avatars";
import type { Profile } from "@/types/domain";

const USER_ID = "member-123";
const OTHER_ID = "member-456";
const AVATAR_ID = "018f0f65-6748-7d19-9f52-111f6bc4278a";
const OLD_AVATAR_ID = "018f0f65-6748-7d19-9f52-111f6bc4278b";
const AVATAR_KEY = `avatars/members/${USER_ID}/${AVATAR_ID}.webp`;
const OLD_AVATAR_KEY = `avatars/members/${USER_ID}/${OLD_AVATAR_ID}.webp`;

const mocks = vi.hoisted(() => ({
  getApiMember: vi.fn(),
  createUploadUrl: vi.fn(),
  createReadUrl: vi.fn(),
  deleteObjects: vi.fn(),
  updateProfile: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiMember: mocks.getApiMember }));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({
    createUploadUrl: mocks.createUploadUrl,
    createReadUrl: mocks.createReadUrl,
    deleteObjects: mocks.deleteObjects,
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      update: mocks.updateProfile.mockImplementation(() => ({
        eq: mocks.updateEq,
      })),
    })),
  })),
}));

const user: Profile = {
  id: USER_ID,
  email: "123456789@qq.com",
  displayName: "拾光同学",
  avatarKey: null,
  role: "member",
  status: "approved",
  showRealName: true,
  allowOriginalDownload: true,
  createdAt: "2026-01-01",
};

describe("profile avatar helpers", () => {
  it("only derives QQ numbers from numeric qq.com email addresses", () => {
    expect(qqNumberFromEmail("12345@qq.com")).toBe("12345");
    expect(qqNumberFromEmail("123456789@QQ.COM")).toBe("123456789");
    expect(qqNumberFromEmail("nickname@qq.com")).toBeNull();
    expect(qqNumberFromEmail("12345@foxmail.com")).toBeNull();
    expect(qqNumberFromEmail("1234@qq.com")).toBeNull();
    expect(qqAvatarUrl("12345")).toBe(
      "https://q1.qlogo.cn/g?b=qq&nk=12345&s=640",
    );
  });

  it("binds avatar object keys to the current user and a UUID", () => {
    expect(createAvatarKey(USER_ID, AVATAR_ID)).toBe(AVATAR_KEY);
    expect(avatarKeyBelongsToUser(USER_ID, AVATAR_KEY)).toBe(true);
    expect(avatarKeyBelongsToUser(OTHER_ID, AVATAR_KEY)).toBe(false);
    expect(
      avatarKeyBelongsToUser(USER_ID, `avatars/members/${USER_ID}/../photo.webp`),
    ).toBe(false);
    expect(avatarVersion(AVATAR_KEY)).toBe(AVATAR_ID);
  });

  it("only signs small processed WebP avatar blobs", () => {
    expect(
      avatarUploadSignSchema.safeParse({ type: "image/webp", size: 1024 }).success,
    ).toBe(true);
    expect(
      avatarUploadSignSchema.safeParse({ type: "image/svg+xml", size: 1024 }).success,
    ).toBe(false);
    expect(
      avatarUploadSignSchema.safeParse({
        type: "image/webp",
        size: 2 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });
});

describe("profile avatar routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiMember.mockResolvedValue(user);
    mocks.createUploadUrl.mockResolvedValue("https://r2.example/upload");
    mocks.createReadUrl.mockResolvedValue("https://r2.example/read");
    mocks.deleteObjects.mockResolvedValue(undefined);
    mocks.updateEq.mockResolvedValue({ error: null });
  });

  it("rejects unauthenticated signing before storage is reached", async () => {
    mocks.getApiMember.mockResolvedValue(null);
    const { POST } = await import("@/app/api/profile/avatar/sign/route");
    const response = await POST(
      new Request("http://localhost/api/profile/avatar/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image/webp", size: 1024 }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createUploadUrl).not.toHaveBeenCalled();
  });

  it("creates a current-user upload key for processed WebP data", async () => {
    const { POST } = await import("@/app/api/profile/avatar/sign/route");
    const response = await POST(
      new Request("http://localhost/api/profile/avatar/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image/webp", size: 1024 }),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(avatarKeyBelongsToUser(USER_ID, result.key)).toBe(true);
    expect(mocks.createUploadUrl).toHaveBeenCalledWith({
      key: result.key,
      contentType: "image/webp",
      contentLength: 1024,
    });
  });

  it("only signs a valid current-user custom avatar for reading", async () => {
    mocks.getApiMember.mockResolvedValue({ ...user, avatarKey: AVATAR_KEY });
    const { GET } = await import("@/app/api/profile/avatar/route");
    const response = await GET(
      new Request("http://localhost/api/profile/avatar"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://r2.example/read");
    expect(mocks.createReadUrl).toHaveBeenCalledWith({
      key: AVATAR_KEY,
      expiresIn: 300,
    });
  });

  it("redirects a numeric QQ email to its default avatar", async () => {
    const { GET } = await import("@/app/api/profile/avatar/route");
    const response = await GET(
      new Request("http://localhost/api/profile/avatar"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640",
    );
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });

  it("can force the QQ default without reading a custom avatar", async () => {
    mocks.getApiMember.mockResolvedValue({ ...user, avatarKey: AVATAR_KEY });
    const { GET } = await import("@/app/api/profile/avatar/route");
    const response = await GET(
      new Request("http://localhost/api/profile/avatar?default=qq"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640",
    );
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });

  it("never signs a foreign storage key and falls back to the numeric QQ avatar", async () => {
    mocks.getApiMember.mockResolvedValue({
      ...user,
      avatarKey: "originals/members/member-456/private.jpg",
    });
    const { GET } = await import("@/app/api/profile/avatar/route");
    const response = await GET(
      new Request("http://localhost/api/profile/avatar"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640",
    );
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });

  it("rejects cross-user avatar updates before touching the database", async () => {
    const { PATCH } = await import("@/app/api/profile/avatar/route");
    const response = await PATCH(
      new Request("http://localhost/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarKey: `avatars/members/${OTHER_ID}/${AVATAR_ID}.webp`,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
  });

  it("updates the database before deleting the previous avatar", async () => {
    mocks.getApiMember.mockResolvedValue({ ...user, avatarKey: OLD_AVATAR_KEY });
    const { PATCH } = await import("@/app/api/profile/avatar/route");
    const response = await PATCH(
      new Request("http://localhost/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarKey: AVATAR_KEY }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledWith({ avatar_key: AVATAR_KEY });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", USER_ID);
    expect(mocks.deleteObjects).toHaveBeenCalledWith([OLD_AVATAR_KEY]);
    expect(mocks.updateProfile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObjects.mock.invocationCallOrder[0],
    );
  });

  it("cleans the newly uploaded object when the database update fails", async () => {
    mocks.updateEq.mockResolvedValue({ error: new Error("database failed") });
    mocks.getApiMember.mockResolvedValue({ ...user, avatarKey: OLD_AVATAR_KEY });
    const { PATCH } = await import("@/app/api/profile/avatar/route");
    const response = await PATCH(
      new Request("http://localhost/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarKey: AVATAR_KEY }),
      }),
    );

    expect(response.status).toBe(500);
    expect(mocks.deleteObjects).toHaveBeenCalledWith([AVATAR_KEY]);
    expect(mocks.deleteObjects).not.toHaveBeenCalledWith([OLD_AVATAR_KEY]);
  });

  it("clears the database before deleting the current custom avatar", async () => {
    mocks.getApiMember.mockResolvedValue({ ...user, avatarKey: OLD_AVATAR_KEY });
    const { DELETE } = await import("@/app/api/profile/avatar/route");
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledWith({ avatar_key: null });
    expect(mocks.deleteObjects).toHaveBeenCalledWith([OLD_AVATAR_KEY]);
    expect(mocks.updateProfile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObjects.mock.invocationCallOrder[0],
    );
  });
});
