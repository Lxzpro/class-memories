import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { writeAdminLog } from "@/lib/admin-audit";

describe("administrator audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.createSupabaseAdminClient.mockResolvedValue({ from: mocks.from });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("does not propagate an admin client initialization failure", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.createSupabaseAdminClient.mockRejectedValueOnce(
      new Error("Supabase unavailable"),
    );

    await expect(
      writeAdminLog(
        "admin-one",
        "privacy_request_resolved",
        "privacy_request",
        "request-one",
      ),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "admin_audit_write_failed",
      expect.objectContaining({
        action: "privacy_request_resolved",
        resourceType: "privacy_request",
        resourceId: "request-one",
        reason: "Error",
      }),
    );
    expect(mocks.from).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not propagate an insert error returned by Supabase", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.insert.mockResolvedValueOnce({ error: { code: "42501" } });

    await expect(
      writeAdminLog(
        "admin-one",
        "privacy_request_rejected",
        "privacy_request",
        "request-two",
        { reason: "not applicable" },
      ),
    ).resolves.toBeUndefined();

    expect(mocks.insert).toHaveBeenCalledWith({
      admin_id: "admin-one",
      action: "privacy_request_rejected",
      resource_type: "privacy_request",
      resource_id: "request-two",
      metadata: { reason: "not applicable" },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "admin_audit_write_failed",
      expect.objectContaining({ reason: "42501" }),
    );
    errorSpy.mockRestore();
  });
});
