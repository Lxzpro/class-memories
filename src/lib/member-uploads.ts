import { z } from "zod";

export const mediaUploadTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

export const memberUploadSignSchema = z.object({
  name: z.string().trim().min(1).max(180),
  type: mediaUploadTypeSchema,
  size: z
    .number()
    .int()
    .positive()
    .max(200 * 1024 * 1024),
  previewSize: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
  thumbnailSize: z
    .number()
    .int()
    .positive()
    .max(3 * 1024 * 1024),
}).superRefine((file, context) => {
  if (file.type.startsWith("image/") && file.size > 25 * 1024 * 1024) {
    context.addIssue({ code: "custom", path: ["size"], message: "图片不能超过 25MB" });
  }
});

export const memberPhotoSubmissionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  location: z.string().trim().max(100),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mediaType: z.enum(["photo", "video"]).default("photo"),
  visibility: z.enum(["class", "private"]),
  originalKey: z.string().min(1).max(500),
  previewKey: z.string().min(1).max(500),
  thumbnailKey: z.string().min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  peopleIds: z.array(z.string().min(1).max(80)).max(80).default([]),
});

function assertSafeSegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`${label}格式不正确`);
}

function extensionFor(type: z.infer<typeof mediaUploadTypeSchema>) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  return "jpg";
}

export function createMemberUploadKeys(
  userId: string,
  photoId: string,
  type: z.infer<typeof mediaUploadTypeSchema>,
) {
  assertSafeSegment(userId, "用户标识");
  assertSafeSegment(photoId, "照片标识");
  return {
    original: `originals/members/${userId}/${photoId}/memory.${extensionFor(type)}`,
    preview: `previews/members/${userId}/${photoId}.webp`,
    thumbnail: `thumbnails/members/${userId}/${photoId}.webp`,
  };
}

export function submissionKeysBelongToUser(
  userId: string,
  photo: z.infer<typeof memberPhotoSubmissionSchema>,
) {
  assertSafeSegment(userId, "用户标识");
  const extensions = photo.mediaType === "video" ? "mp4|webm" : "jpg|png|webp";
  const originalPattern = new RegExp(`^originals/members/${userId}/${photo.id}/memory\\.(${extensions})$`);
  return (
    originalPattern.test(photo.originalKey) &&
    photo.previewKey === `previews/members/${userId}/${photo.id}.webp` &&
    photo.thumbnailKey === `thumbnails/members/${userId}/${photo.id}.webp`
  );
}
