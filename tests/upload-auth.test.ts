import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-auth", () => ({ getApiAdmin: vi.fn(async () => null) }));
vi.mock("@/lib/admin-audit", () => ({ writeAdminLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/storage", () => ({ getStorageAdapter: vi.fn(() => { throw new Error("storage must not be reached"); }) }));

describe("R2 upload signing authorization", () => {
  it("rejects an unauthenticated signing request before touching storage", async () => {
    const { POST } = await import("@/app/api/admin/uploads/sign/route");
    const response = await POST(new Request("http://localhost/api/admin/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "memory.jpg", type: "image/jpeg", size: 10, previewSize: 10, thumbnailSize: 10 }),
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "仅管理员可以上传照片。" });
  });
});
