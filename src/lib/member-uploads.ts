import { z } from "zod";

const imageTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const memberUploadSignSchema = z.object({
  name: z.string().trim().min(1).max(180),
  type: imageTypeSchema,
  size: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
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
});

export const memberPhotoSubmissionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  location: z.string().trim().max(100),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  visibility: z.enum(["class", "private"]),
  originalKey: z.string().min(1).max(500),
  previewKey: z.string().min(1).max(500),
  thumbnailKey: z.string().min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
});

function assertSafeSegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`${label}格式不正确`);
}

function extensionFor(type: z.infer<typeof imageTypeSchema>) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function createMemberUploadKeys(
  userId: string,
  photoId: string,
  type: z.infer<typeof imageTypeSchema>,
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
  const originalPattern = new RegExp(
    `^originals/members/${userId}/${photo.id}/memory\\.(jpg|png|webp)$`,
  );
  return (
    originalPattern.test(photo.originalKey) &&
    photo.previewKey === `previews/members/${userId}/${photo.id}.webp` &&
    photo.thumbnailKey === `thumbnails/members/${userId}/${photo.id}.webp`
  );
}
