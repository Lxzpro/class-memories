import { z } from "zod";

export const PROFILE_NAME_MIN_LENGTH = 2;
export const PROFILE_NAME_MAX_LENGTH = 30;

export const profileNameSchema = z
  .string()
  .trim()
  .min(PROFILE_NAME_MIN_LENGTH)
  .max(PROFILE_NAME_MAX_LENGTH);

export const registrationIdentitySchema = z.object({
  displayName: profileNameSchema,
  realName: profileNameSchema,
});

const nullableRealNameSchema = z.union([
  profileNameSchema,
  z.literal("").transform(() => null),
  z.null(),
]);

export const profilePatchSchema = z
  .object({
    displayName: profileNameSchema.optional(),
    realName: nullableRealNameSchema.optional(),
    showRealName: z.boolean().optional(),
    allowOriginalDownload: z.boolean().optional(),
    reduceMotion: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    { message: "至少需要提交一项资料。" },
  );

export function getPublicProfileName(profile: {
  displayName: string;
  realName: string | null;
  showRealName: boolean;
}) {
  const realName = profile.realName?.trim();
  return profile.showRealName && realName ? realName : profile.displayName;
}
