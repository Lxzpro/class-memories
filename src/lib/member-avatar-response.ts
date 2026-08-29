import "server-only";

import {
  avatarKeyBelongsToUser,
  qqAvatarUrl,
  qqNumberFromEmail,
} from "@/lib/profile-avatars";
import { getStorageAdapter } from "@/lib/storage";
import type { Profile } from "@/types/domain";

export type MemberAvatarTarget = Pick<
  Profile,
  "id" | "email" | "avatarKey"
>;

export const memberAvatarHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export function memberAvatarError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: memberAvatarHeaders },
  );
}

function redirectTo(url: string) {
  return new Response(null, {
    status: 302,
    headers: { ...memberAvatarHeaders, Location: url },
  });
}

function emptyAvatar() {
  return new Response(null, {
    status: 204,
    headers: memberAvatarHeaders,
  });
}

export async function createMemberAvatarResponse(
  target: MemberAvatarTarget,
  defaultOnly: boolean,
) {
  if (
    !defaultOnly &&
    target.avatarKey &&
    avatarKeyBelongsToUser(target.id, target.avatarKey)
  ) {
    try {
      const readUrl = await getStorageAdapter().createReadUrl({
        key: target.avatarKey,
        expiresIn: 5 * 60,
      });
      return redirectTo(readUrl);
    } catch (error) {
      console.error(
        "创建成员头像读取链接失败，将尝试默认头像。",
        error instanceof Error ? error.name : "unknown",
      );
    }
  }

  const qqNumber = qqNumberFromEmail(target.email);
  if (qqNumber) return redirectTo(qqAvatarUrl(qqNumber));

  return emptyAvatar();
}
