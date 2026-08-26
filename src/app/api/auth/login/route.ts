import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { MOCK_CREDENTIALS, MOCK_PROFILES } from "@/lib/mock-data";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { signToken } from "@/lib/security/tokens";
import { SESSION_COOKIE } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email(), password: z.string().min(6).max(128) });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = checkRateLimit(`login:${ip}`);
  if (!limit.allowed) return Response.json({ error: "登录尝试过多，请稍后再试。" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请输入正确的邮箱和密码。" }, { status: 400 });

  if (DEMO_MODE) {
    const expected = MOCK_CREDENTIALS[parsed.data.email as keyof typeof MOCK_CREDENTIALS];
    const profile = MOCK_PROFILES.find((item) => item.email === parsed.data.email);
    if (!expected || expected !== parsed.data.password || !profile) return Response.json({ error: "邮箱或密码不正确。" }, { status: 401 });
    resetRateLimit(`login:${ip}`);
    const response = Response.json({ ok: true, next: profile.status === "approved" ? (profile.role === "admin" ? "/admin" : "/memories") : "/pending" });
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${signToken({ userId: profile.id }, Date.now() + 30 * 24 * 60 * 60 * 1000)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return Response.json({ error: "邮箱或密码不正确。" }, { status: 401 });
  resetRateLimit(`login:${ip}`);
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).single();
  const next = profile?.status !== "approved" ? "/pending" : profile.role === "admin" ? "/admin" : "/memories";
  return Response.json({ ok: true, next });
}
