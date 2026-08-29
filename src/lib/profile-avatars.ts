import { z } from "zod";

export const AVATAR_INPUT_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_UPDATED_EVENT = "class-memory-avatar-updated";
export const MAX_AVATAR_SOURCE_SIZE = 10 * 1024 * 1024;
export const MAX_AVATAR_UPLOAD_SIZE = 2 * 1024 * 1024;

const AVATAR_KEY_ID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const QQ_EMAIL_PATTERN = /^([1-9][0-9]{4,11})@qq\.com$/i;

export const avatarUploadSignSchema = z.object({
  type: z.literal("image/webp"),
  size: z.number().int().positive().max(MAX_AVATAR_UPLOAD_SIZE),
});

function assertSafeId(value: string, label: string) {
  if (!SAFE_ID_PATTERN.test(value)) throw new Error(`${label}格式不正确`);
}

export function createAvatarKey(userId: string, avatarId: string) {
  assertSafeId(userId, "用户标识");
  if (!new RegExp(`^${AVATAR_KEY_ID_PATTERN}$`).test(avatarId)) {
    throw new Error("头像标识格式不正确");
  }
  return `avatars/members/${userId}/${avatarId}.webp`;
}

export function avatarKeyBelongsToUser(userId: string, key: string | null) {
  if (!key || !SAFE_ID_PATTERN.test(userId)) return false;
  return new RegExp(
    `^avatars/members/${userId}/${AVATAR_KEY_ID_PATTERN}\\.webp$`,
  ).test(key);
}

export function qqNumberFromEmail(email: string) {
  return email.trim().match(QQ_EMAIL_PATTERN)?.[1] ?? null;
}

export function qqAvatarUrl(qqNumber: string) {
  if (!/^[1-9][0-9]{4,11}$/.test(qqNumber)) {
    throw new Error("QQ 号码格式不正确");
  }
  const url = new URL("https://q1.qlogo.cn/g");
  url.searchParams.set("b", "qq");
  url.searchParams.set("nk", qqNumber);
  url.searchParams.set("s", "640");
  return url.toString();
}

export function avatarVersion(avatarKey: string | null) {
  const match = avatarKey?.match(
    new RegExp(`/(${AVATAR_KEY_ID_PATTERN})\\.webp$`),
  );
  return match?.[1] ?? "default";
}
