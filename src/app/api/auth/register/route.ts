import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { signToken, verifyToken } from "@/lib/security/tokens";
import { SESSION_COOKIE } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ displayName: z.string().trim().min(2).max(30), email: z.string().email(), password: z.string().min(8).max(128) });

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  return header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function POST(request: Request) {
  const grant = verifyToken<{ inviteId: string }>(cookieValue(request, "invite_grant"));
  if (!grant) return Response.json({ error: "邀请验证已失效，请重新输入班级口令。" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请完整填写姓名、邮箱和至少 8 位密码。" }, { status: 400 });

  if (DEMO_MODE) {
    const response = Response.json({ ok: true, next: "/pending" });
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${signToken({ userId: "user-pending" }, Date.now() + 7 * 24 * 60 * 60 * 1000)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    response.headers.append("Set-Cookie", "invite_grant=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { display_name: parsed.data.displayName } } });
  if (error || !data.user) return Response.json({ error: error?.message === "User already registered" ? "这个邮箱已经注册。" : "注册失败，请稍后重试。" }, { status: 400 });

  const admin = await createSupabaseAdminClient();
  const { error: redeemError } = await admin.rpc("redeem_invite", { p_invite_id: grant.inviteId, p_user_id: data.user.id });
  if (redeemError) return Response.json({ error: "邀请口令状态发生变化，请联系管理员处理账号。" }, { status: 409 });
  const response = Response.json({ ok: true, next: "/pending", emailConfirmationRequired: !data.session });
  response.headers.append("Set-Cookie", "invite_grant=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
