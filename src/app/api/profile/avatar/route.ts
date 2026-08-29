import { getApiMember } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import {
  avatarKeyBelongsToUser,
  qqAvatarUrl,
  qqNumberFromEmail,
} from "@/lib/profile-avatars";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateSchema = z.object({ avatarKey: z.string().min(1).max(500) });
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function redirectTo(url: string) {
  return new Response(null, {
    status: 302,
    headers: { ...responseHeaders, Location: url },
  });
}

async function removeOldAvatar(userId: string, key: string | null) {
  if (!key || !avatarKeyBelongsToUser(userId, key)) return;
  try {
    await getStorageAdapter().deleteObjects([key]);
  } catch (error) {
    console.error("头像记录已更新，但旧头像对象清理失败。", error);
  }
}

export async function GET(request: Request) {
  const user = await getApiMember();
  if (!user) {
    return Response.json({ error: "请先登录。" }, { status: 401, headers: responseHeaders });
  }

  const defaultOnly = new URL(request.url).searchParams.get("default") === "qq";
  const customAvatarKey = user.avatarKey;
  if (
    !defaultOnly &&
    customAvatarKey &&
    avatarKeyBelongsToUser(user.id, customAvatarKey)
  ) {
    try {
      const readUrl = await getStorageAdapter().createReadUrl({
        key: customAvatarKey,
        expiresIn: 5 * 60,
      });
      return redirectTo(readUrl);
    } catch (error) {
      console.error("创建头像读取链接失败，将尝试默认头像。", error);
    }
  }

  const qqNumber = qqNumberFromEmail(user.email);
  if (qqNumber) return redirectTo(qqAvatarUrl(qqNumber));

  return Response.json(
    { error: "尚未设置头像。" },
    { status: 404, headers: responseHeaders },
  );
}

export async function PATCH(request: Request) {
  const user = await getApiMember();
  if (!user) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !avatarKeyBelongsToUser(user.id, parsed.data.avatarKey)) {
    return Response.json({ error: "头像文件不属于当前账号。" }, { status: 400 });
  }

  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_key: parsed.data.avatarKey })
      .eq("id", user.id);
    if (error) {
      await removeOldAvatar(user.id, parsed.data.avatarKey);
      return Response.json({ error: "保存头像失败，请稍后重试。" }, { status: 500 });
    }
  }

  if (user.avatarKey !== parsed.data.avatarKey) {
    await removeOldAvatar(user.id, user.avatarKey);
  }
  return Response.json({ ok: true, avatarKey: parsed.data.avatarKey });
}

export async function DELETE() {
  const user = await getApiMember();
  if (!user) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_key: null })
      .eq("id", user.id);
    if (error) {
      return Response.json({ error: "恢复默认头像失败，请稍后重试。" }, { status: 500 });
    }
  }

  await removeOldAvatar(user.id, user.avatarKey);
  return Response.json({ ok: true });
}
