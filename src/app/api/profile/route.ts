import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessMemberArea } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ showRealName: z.boolean(), allowOriginalDownload: z.boolean(), reduceMotion: z.boolean(), soundEnabled: z.boolean() });

export async function PATCH(request: Request) {
  const user = await getCurrentUser(); if (!canAccessMemberArea(user)) return Response.json({ error: "请先登录。" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "偏好设置格式不正确。" }, { status: 400 });
  if (!DEMO_MODE) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").update({ show_real_name: parsed.data.showRealName, allow_original_download: parsed.data.allowOriginalDownload }).eq("id", user.id);
    if (error) return Response.json({ error: "保存失败。" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
