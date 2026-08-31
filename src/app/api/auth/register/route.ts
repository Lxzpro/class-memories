import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { signToken } from "@/lib/security/tokens";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SESSION_COOKIE } from "@/lib/auth";
import { registrationIdentitySchema } from "@/lib/profile-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = registrationIdentitySchema.extend({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = checkRateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "注册请求过于频繁，请稍后再试。", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请完整填写真实姓名、昵称、邮箱和至少 8 位密码。" }, { status: 400 });

  if (DEMO_MODE) {
    const response = Response.json({ ok: true, next: "/pending" });
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${signToken({ userId: "user-pending" }, Date.now() + 7 * 24 * 60 * 60 * 1000)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const origin = new URL(request.url).origin;
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        real_name: parsed.data.realName,
      },
      emailRedirectTo: origin + "/auth/callback?next=/pending",
    },
  });
  if (error || !data.user) return Response.json({ error: error?.message === "User already registered" ? "这个邮箱已经注册。" : "注册失败，请稍后重试。" }, { status: 400 });

  return Response.json({ ok: true, next: "/pending", emailConfirmationRequired: !data.session });
}
