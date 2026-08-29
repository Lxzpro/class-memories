import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth })),
}));

describe("password recovery callback", () => {
  beforeEach(() => {
    auth.exchangeCodeForSession.mockReset();
    auth.verifyOtp.mockReset();
  });

  it("verifies a recovery token and opens the new-password page", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://example.com/auth/callback?next=/reset-password&token_hash=valid&type=recovery"));

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "valid", type: "recovery" });
    expect(response.headers.get("location")).toBe("https://example.com/reset-password");
  });

  it("sends expired recovery links back to the request page", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://example.com/auth/callback?token_hash=expired&type=recovery"));

    expect(response.headers.get("location")).toBe("https://example.com/forgot-password?error=invalid_recovery");
  });

  it("verifies a recovery token only after the user submits the confirmation form", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const { POST } = await import("@/app/auth/callback/route");
    const formData = new FormData();
    formData.set("token_hash", "valid");
    const response = await POST(new Request("https://example.com/auth/callback", { method: "POST", body: formData }));

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "valid", type: "recovery" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/reset-password");
  });

  it("rejects an expired token submitted from the recovery confirmation page", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const { POST } = await import("@/app/auth/callback/route");
    const formData = new FormData();
    formData.set("token_hash", "expired");
    const response = await POST(new Request("https://example.com/auth/callback", { method: "POST", body: formData }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/forgot-password?error=invalid_recovery");
  });

  it("does not allow an external next URL", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://example.com/auth/callback?next=//evil.example&token_hash=valid&type=recovery"));

    expect(response.headers.get("location")).toBe("https://example.com/reset-password");
  });

  it("verifies a registration email and opens the member-review page", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://example.com/auth/callback?next=/pending&token_hash=valid&type=email"));

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "valid", type: "email" });
    expect(response.headers.get("location")).toBe("https://example.com/pending");
  });

  it("sends expired registration links to login with a clear error", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://example.com/auth/callback?token_hash=expired&type=email"));

    expect(response.headers.get("location")).toBe("https://example.com/login?error=email_confirmation");
  });
});
