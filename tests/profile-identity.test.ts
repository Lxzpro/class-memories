import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublicProfileName,
  profilePatchSchema,
  registrationIdentitySchema,
} from "@/lib/profile-identity";
import type { Profile } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  signUp: vi.fn(),
  updateProfile: vi.fn(),
  updateEq: vi.fn(),
  signToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
  SESSION_COOKIE: "class_memory_session",
}));
vi.mock("@/lib/authz", () => ({
  canAccessMemberArea: (user: Profile | null) =>
    Boolean(user && user.status === "approved"),
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/security/tokens", () => ({
  signToken: mocks.signToken,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signUp: mocks.signUp },
    from: vi.fn(() => ({
      update: mocks.updateProfile.mockImplementation(() => ({
        eq: mocks.updateEq,
      })),
    })),
  })),
}));

const user: Profile = {
  id: "member-id",
  email: "member@example.com",
  displayName: "小夏",
  realName: "夏宁",
  avatarKey: null,
  role: "member",
  status: "approved",
  showRealName: true,
  allowOriginalDownload: false,
  createdAt: "2026-01-01",
};

describe("profile identity rules", () => {
  it("only exposes a real name when both consent and a value are present", () => {
    expect(getPublicProfileName(user)).toBe("夏宁");
    expect(getPublicProfileName({ ...user, showRealName: false })).toBe("小夏");
    expect(getPublicProfileName({ ...user, realName: null })).toBe("小夏");
  });

  it("trims both registration names and requires each one", () => {
    expect(
      registrationIdentitySchema.parse({
        displayName: "  小夏  ",
        realName: "  夏宁  ",
      }),
    ).toEqual({ displayName: "小夏", realName: "夏宁" });
    expect(
      registrationIdentitySchema.safeParse({
        displayName: "小夏",
        realName: "",
      }).success,
    ).toBe(false);
  });

  it("accepts partial profile updates and normalizes an empty real name", () => {
    expect(profilePatchSchema.parse({ displayName: "  新昵称  " })).toEqual({
      displayName: "新昵称",
    });
    expect(profilePatchSchema.parse({ realName: "" })).toEqual({
      realName: null,
    });
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
  });
});

describe("profile identity routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "new-user-id" }, session: null },
      error: null,
    });
  });

  it("updates only submitted database-backed profile fields", async () => {
    const { PATCH } = await import("@/app/api/profile/route");
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "  新昵称  ",
          realName: "  李小夏  ",
          showRealName: false,
          allowOriginalDownload: true,
          reduceMotion: true,
          soundEnabled: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      display_name: "新昵称",
      real_name: "李小夏",
      show_real_name: false,
      allow_original_download: true,
    });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "member-id");
    await expect(response.json()).resolves.toMatchObject({
      profile: {
        displayName: "新昵称",
        realName: "李小夏",
        showRealName: false,
      },
    });
  });

  it("keeps browser-only preferences out of the database update", async () => {
    const { PATCH } = await import("@/app/api/profile/route");
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reduceMotion: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects invalid or unauthenticated profile updates", async () => {
    const { PATCH } = await import("@/app/api/profile/route");
    const invalid = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "一" }),
      }),
    );
    expect(invalid.status).toBe(400);

    mocks.getCurrentUser.mockResolvedValue(null);
    const unauthenticated = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "新昵称" }),
      }),
    );
    expect(unauthenticated.status).toBe(401);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("registers without a class code and sends both names to Supabase", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("https://www.lxzblog.click/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "  小夏  ",
          realName: "  夏宁  ",
          email: " member@example.com ",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "member@example.com",
      password: "password123",
      options: {
        data: { display_name: "小夏", real_name: "夏宁" },
        emailRedirectTo:
          "https://www.lxzblog.click/auth/callback?next=/pending",
      },
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      next: "/pending",
      emailConfirmationRequired: true,
    });
  });

  it("requires a real name before creating an auth user", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "小夏",
          realName: "",
          email: "member@example.com",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});
