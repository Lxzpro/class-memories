import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  getApiAdmin: vi.fn(),
  maybeSingle: vi.fn(),
  reassignSelect: vi.fn(),
  rollbackIn: vi.fn(),
  writeAdminLog: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiAdmin: mocks.getApiAdmin }));
vi.mock("@/lib/admin-audit", () => ({ writeAdminLog: mocks.writeAdminLog }));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({
    auth: { admin: { deleteUser: mocks.deleteUser } },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
          })),
        };
      }
      if (table === "photos") {
        return {
          update: vi.fn((values: { uploaded_by: string }) =>
            values.uploaded_by === "admin-id"
              ? {
                  eq: vi.fn(() => ({ select: mocks.reassignSelect })),
                }
              : { in: mocks.rollbackIn },
          ),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
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
  requireTagApproval: false,
  allowOriginalDownload: true,
  createdAt: "2026-01-01",
};

function removeMember(id: string) {
  return import("@/app/api/admin/members/[id]/route").then(({ DELETE }) =>
    DELETE(new Request(`http://localhost/api/admin/members/${id}`), {
      params: Promise.resolve({ id }),
    }),
  );
}

describe("admin member deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiAdmin.mockResolvedValue(admin);
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "member-id",
        display_name: "待删除同学",
        role: "member",
        status: "approved",
      },
      error: null,
    });
    mocks.reassignSelect.mockResolvedValue({
      data: [{ id: "photo-id" }],
      error: null,
    });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.rollbackIn.mockResolvedValue({ error: null });
    mocks.writeAdminLog.mockResolvedValue(undefined);
  });

  it("rejects callers who are not administrators", async () => {
    mocks.getApiAdmin.mockResolvedValue(null);
    const response = await removeMember("member-id");

    expect(response.status).toBe(403);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("does not allow an administrator to delete their own account", async () => {
    const response = await removeMember("admin-id");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "不能删除当前登录的管理员账号。",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("reassigns uploaded photos before deleting the auth user", async () => {
    const response = await removeMember("member-id");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      newOwnerId: "admin-id",
      reassignedPhotoCount: 1,
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith("member-id");
    expect(mocks.writeAdminLog).toHaveBeenCalledWith(
      "admin-id",
      "member_deleted",
      "profile",
      "member-id",
      expect.objectContaining({ reassignedPhotoCount: 1 }),
    );
  });

  it("rolls photo ownership back when auth deletion fails", async () => {
    mocks.deleteUser.mockResolvedValue({ error: new Error("delete failed") });
    const response = await removeMember("member-id");

    expect(response.status).toBe(500);
    expect(mocks.rollbackIn).toHaveBeenCalledWith("id", ["photo-id"]);
    expect(mocks.writeAdminLog).not.toHaveBeenCalled();
  });
});
