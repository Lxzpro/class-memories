import { getApiMember } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import {
  createMemberAvatarResponse,
  memberAvatarError,
  type MemberAvatarTarget,
} from "@/lib/member-avatar-response";
import { getMockProfile } from "@/lib/mock-data";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [viewer, { id }] = await Promise.all([getApiMember(), params]);
  if (!viewer) return memberAvatarError("请先登录。", 401);
  if (!id || id.length > 128) return memberAvatarError("成员不存在。", 404);

  let target: MemberAvatarTarget | null = null;
  if (DEMO_MODE) {
    const profile = getMockProfile(id);
    if (profile?.status === "approved") {
      target = {
        id: profile.id,
        email: profile.email,
        avatarKey: profile.avatarKey,
      };
    }
  } else {
    const supabase = await createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,avatar_key")
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();

    if (error) return memberAvatarError("读取成员头像失败。", 500);
    if (data) {
      target = {
        id: String(data.id),
        email: String(data.email),
        avatarKey: data.avatar_key ? String(data.avatar_key) : null,
      };
    }
  }

  if (!target) return memberAvatarError("成员不存在。", 404);

  const defaultOnly =
    new URL(request.url).searchParams.get("default") === "qq";
  return createMemberAvatarResponse(target, defaultOnly);
}
