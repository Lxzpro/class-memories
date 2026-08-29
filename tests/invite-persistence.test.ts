import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptInviteCode,
  encryptInviteCode,
  hashInviteCode,
} from "@/lib/security/tokens";

const mocks = vi.hoisted(() => ({
  getApiAdmin: vi.fn(),
  writeAdminLog: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiAdmin: mocks.getApiAdmin }));
vi.mock("@/lib/admin-audit", () => ({ writeAdminLog: mocks.writeAdminLog }));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({ from: mocks.from })),
}));

const inviteId = "018f0f65-6748-7d19-9f52-111f6bc4278c";

describe("persistent administrator invite-code access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiAdmin.mockResolvedValue({ id: "admin-id", role: "admin" });
    mocks.writeAdminLog.mockResolvedValue(undefined);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({
      insert: mocks.insert,
      select: mocks.select,
    });
  });

  it("stores a hash plus authenticated ciphertext, never a plaintext database field", async () => {
    const { POST } = await import("@/app/api/admin/invites/route");
    const response = await POST(
      new Request("http://localhost/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validDays: 7, maxUses: 10 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.insert).toHaveBeenCalledOnce();
    const inserted = mocks.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted).not.toHaveProperty("code");
    expect(inserted.code_hash).toBe(hashInviteCode(body.invite.code));
    expect(inserted.code_ciphertext).not.toContain(body.invite.code);
    expect(decryptInviteCode(String(inserted.code_ciphertext))).toBe(body.invite.code);
    expect(JSON.stringify(mocks.writeAdminLog.mock.calls)).not.toContain(body.invite.code);
  });

  it("re-authorizes every reveal and does not touch storage for non-admins", async () => {
    mocks.getApiAdmin.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/invites/[id]/code/route");
    const response = await GET(
      new Request("http://localhost/api/admin/invites/" + inviteId + "/code"),
      { params: Promise.resolve({ id: inviteId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("decrypts a stored code only on demand and prevents response caching", async () => {
    const ciphertext = encryptInviteCode("CLASS-1234ABCD");
    mocks.maybeSingle.mockResolvedValue({
      data: {
        code_ciphertext: ciphertext,
        code_hash: hashInviteCode("CLASS-1234ABCD"),
      },
      error: null,
    });
    const { GET } = await import("@/app/api/admin/invites/[id]/code/route");
    const response = await GET(
      new Request("http://localhost/api/admin/invites/" + inviteId + "/code"),
      { params: Promise.resolve({ id: inviteId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ code: "CLASS-1234ABCD" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.select).toHaveBeenCalledWith("code_ciphertext,code_hash");
    expect(mocks.eq).toHaveBeenCalledWith("id", inviteId);
  });

  it("rejects ciphertext that does not match the invite record hash", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        code_ciphertext: encryptInviteCode("CLASS-1234ABCD"),
        code_hash: hashInviteCode("CLASS-DIFFERENT"),
      },
      error: null,
    });
    const { GET } = await import("@/app/api/admin/invites/[id]/code/route");
    const response = await GET(
      new Request("http://localhost/api/admin/invites/" + inviteId + "/code"),
      { params: Promise.resolve({ id: inviteId }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "邀请口令校验失败，请创建新邀请。",
    });
  });

  it("explains that historical hash-only invites cannot be recovered", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { code_ciphertext: null },
      error: null,
    });
    const { GET } = await import("@/app/api/admin/invites/[id]/code/route");
    const response = await GET(
      new Request("http://localhost/api/admin/invites/" + inviteId + "/code"),
      { params: Promise.resolve({ id: inviteId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "这个历史邀请只保留不可逆哈希，无法恢复原口令。请创建新邀请。",
    });
  });
});
