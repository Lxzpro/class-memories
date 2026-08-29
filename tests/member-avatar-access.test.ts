import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types/domain";

const MEMBER_ID = "member-123";
const AVATAR_ID = "018f0f65-6748-7d19-9f52-111f6bc4278a";
const AVATAR_KEY = `avatars/members/${MEMBER_ID}/${AVATAR_ID}.webp`;

const mocks = vi.hoisted(() => ({
  getApiAdmin: vi.fn(),
  getApiMember: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  createReadUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));

type QueryMock = {
  eq: (column: string, value: string) => QueryMock;
  maybeSingle: typeof mocks.maybeSingle;
};

vi.mock("@/lib/api-auth", () => ({
  getApiAdmin: mocks.getApiAdmin,
  getApiMember: mocks.getApiMember,
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ createReadUrl: mocks.createReadUrl })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({
    from: (table: string) => {
      mocks.from(table);
      return {
        select: (columns: string) => {
          mocks.select(columns);
          const query: QueryMock = {
            eq: (column, value) => {
              mocks.eq(column, value);
              return query;
            },
            maybeSingle: mocks.maybeSingle,
          };
          return query;
        },
      };
    },
  })),
}));

const admin: Profile = {
  id: "admin-id",
  email: "admin@example.com",
  displayName: "管理员",
  avatarKey: null,
  role: "admin",
  status: "approved",
  showRealName: true,
  allowOriginalDownload: true,
  createdAt: "2026-01-01",
};

const member: Profile = {
  ...admin,
  id: "viewer-id",
  displayName: "查看相册的同学",
  role: "member",
};

function target(avatarKey: string | null = AVATAR_KEY) {
  return {
    data: {
      id: MEMBER_ID,
      email: "123456789@qq.com",
      avatar_key: avatarKey,
    },
    error: null,
  };
}

async function readAdminAvatar(query = "") {
  const { GET } = await import(
    "@/app/api/admin/members/[id]/avatar/route"
  );
  return GET(
    new Request(
      `http://localhost/api/admin/members/${MEMBER_ID}/avatar${query}`,
    ),
    { params: Promise.resolve({ id: MEMBER_ID }) },
  );
}

async function readMemberAvatar() {
  const { GET } = await import("@/app/api/members/[id]/avatar/route");
  return GET(
    new Request(
      `http://localhost/api/members/${MEMBER_ID}/avatar`,
    ),
    { params: Promise.resolve({ id: MEMBER_ID }) },
  );
}

describe("member avatar access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiAdmin.mockResolvedValue(admin);
    mocks.getApiMember.mockResolvedValue(member);
    mocks.maybeSingle.mockResolvedValue(target());
    mocks.createReadUrl.mockResolvedValue(
      "https://r2.example/member-avatar",
    );
  });

  it("rejects non-admin callers before querying an admin member avatar", async () => {
    mocks.getApiAdmin.mockResolvedValue(null);

    const response = await readAdminAvatar();

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });

  it("signs a valid target-owned custom avatar for an administrator", async () => {
    const response = await readAdminAvatar();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://r2.example/member-avatar",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.createReadUrl).toHaveBeenCalledWith({
      key: AVATAR_KEY,
      expiresIn: 300,
    });
  });

  it("never signs a foreign key and falls back to the target QQ avatar", async () => {
    mocks.maybeSingle.mockResolvedValue(
      target(
        "avatars/members/member-456/018f0f65-6748-7d19-9f52-111f6bc4278b.webp",
      ),
    );

    const response = await readAdminAvatar();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640",
    );
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });

  it("can request the QQ default without signing custom storage", async () => {
    const response = await readAdminAvatar("?default=qq");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("q1.qlogo.cn");
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });

  it("only exposes approved member avatars to signed-in class members", async () => {
    mocks.maybeSingle.mockResolvedValue(target(null));

    const response = await readMemberAvatar();

    expect(response.status).toBe(302);
    expect(mocks.eq).toHaveBeenCalledWith("id", MEMBER_ID);
    expect(mocks.eq).toHaveBeenCalledWith("status", "approved");
    expect(response.headers.get("location")).toContain("q1.qlogo.cn");
  });

  it("rejects unauthenticated class-member avatar requests before querying", async () => {
    mocks.getApiMember.mockResolvedValue(null);

    const response = await readMemberAvatar();

    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns a private empty response when the target has no usable avatar", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: MEMBER_ID,
        email: "nickname@example.com",
        avatar_key: null,
      },
      error: null,
    });

    const response = await readMemberAvatar();

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
