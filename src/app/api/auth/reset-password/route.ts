import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请输入有效邮箱。" }, { status: 400 });
  if (!DEMO_MODE) {
    const supabase = await createSupabaseServerClient();
    const origin = new URL(request.url).origin;
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  }
  return Response.json({ ok: true, message: "如果账号存在，重置邮件将会发送。" });
}
