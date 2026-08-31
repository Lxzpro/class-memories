import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAdmin: vi.fn(),
  writeAdminLog: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eqId: vi.fn(),
  eqRole: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  getApiAdmin: mocks.getApiAdmin,
}));
vi.mock("@/lib/admin-audit", () => ({
  writeAdminLog: mocks.writeAdminLog,
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

describe("administrator member review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiAdmin.mockResolvedValue({ id: "admin-id" });
    mocks.eqRole.mockResolvedValue({ error: null });
    mocks.eqId.mockReturnValue({ eq: mocks.eqRole });
    mocks.update.mockReturnValue({ eq: mocks.eqId });
    mocks.from.mockReturnValue({ update: mocks.update });
  });

  it("approves a pending member through the existing administrator flow", async () => {
    const { POST } = await import("@/app/api/admin/members/[id]/review/route");
    const response = await POST(
      new Request("http://localhost/api/admin/members/member-id/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: "member-id" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith({ status: "approved" });
    expect(mocks.eqId).toHaveBeenCalledWith("id", "member-id");
    expect(mocks.eqRole).toHaveBeenCalledWith("role", "member");
    expect(mocks.writeAdminLog).toHaveBeenCalledWith(
      "admin-id",
      "member_approved",
      "profile",
      "member-id",
    );
  });

  it("rejects unauthenticated and self-review requests", async () => {
    const { POST } = await import("@/app/api/admin/members/[id]/review/route");
    mocks.getApiAdmin.mockResolvedValueOnce(null);
    const unauthorized = await POST(
      new Request("http://localhost/api/admin/members/member-id/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: "member-id" }) },
    );
    expect(unauthorized.status).toBe(403);

    const selfReview = await POST(
      new Request("http://localhost/api/admin/members/admin-id/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: "admin-id" }) },
    );
    expect(selfReview.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
