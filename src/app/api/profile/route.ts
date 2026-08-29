import { getCurrentUser } from "@/lib/auth";
import { canAccessMemberArea } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { profilePatchSchema } from "@/lib/profile-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const user = await getCurrentUser(); if (!canAccessMemberArea(user)) return Response.json({ error: "请先登录。" }, { status: 401 });
  const parsed = profilePatchSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "个人资料或偏好设置格式不正确。" }, { status: 400 });
  const profileUpdates: Record<string, string | boolean | null> = {};
  if (parsed.data.displayName !== undefined) profileUpdates.display_name = parsed.data.displayName;
  if (parsed.data.realName !== undefined) profileUpdates.real_name = parsed.data.realName;
  if (parsed.data.showRealName !== undefined) profileUpdates.show_real_name = parsed.data.showRealName;
  if (parsed.data.allowOriginalDownload !== undefined) profileUpdates.allow_original_download = parsed.data.allowOriginalDownload;

  if (!DEMO_MODE && Object.keys(profileUpdates).length > 0) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", user.id);
    if (error) return Response.json({ error: "保存失败。" }, { status: 500 });
  }
  return Response.json({
    ok: true,
    profile: {
      displayName: parsed.data.displayName ?? user.displayName,
      realName: parsed.data.realName === undefined ? user.realName : parsed.data.realName,
      showRealName: parsed.data.showRealName ?? user.showRealName,
      allowOriginalDownload: parsed.data.allowOriginalDownload ?? user.allowOriginalDownload,
    },
  });
}
