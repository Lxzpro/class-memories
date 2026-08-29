import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(),
}));

import { config } from "@/proxy";

function proxyMatches(url: string) {
  return unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });
}

describe("Supabase session proxy routing", () => {
  it.each([
    "/admin",
    "/admin?tab=members",
    "/api/auth/login",
    "/memories",
    "/pending",
    "/photos",
    "/profile",
    "/random",
    "/reset-password",
    "/upload",
    "/videos",
  ])("refreshes sessions on protected or session-mutating route %s", (url) => {
    expect(proxyMatches(url)).toBe(true);
  });

  it.each([
    "/",
    "/auth/callback?token_hash=example&type=recovery",
    "/forgot-password",
    "/invite",
    "/login",
    "/register",
    "/_next/static/chunks/app.js",
    "/brand-logo.png",
  ])("does not add an auth round trip to public route %s", (url) => {
    expect(proxyMatches(url)).toBe(false);
  });
});
