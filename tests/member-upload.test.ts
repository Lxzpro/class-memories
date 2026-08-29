import { describe, expect, it, vi } from "vitest";
import { validateMediaFile } from "@/lib/client-media";
import {
  MAX_IMAGE_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE_MB,
} from "@/lib/media-limits";
import {
  createMemberUploadKeys,
  memberPhotoSubmissionSchema,
  memberUploadSignSchema,
  submissionKeysBelongToUser,
} from "@/lib/member-uploads";

vi.mock("@/lib/api-auth", () => ({ getApiMember: vi.fn(async () => null) }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => {
    throw new Error("storage must not be reached");
  }),
}));

describe("member photo uploads", () => {
  it("binds every object key to the authenticated member and photo id", () => {
    const id = "018f0f65-6748-7d19-9f52-111f6bc4278a";
    const keys = createMemberUploadKeys("member-123", id, "image/jpeg");
    const photo = memberPhotoSubmissionSchema.parse({
      id,
      title: "放学后的操场",
      description: "",
      location: "操场",
      width: 1600,
      height: 1200,
      mediaType: "photo",
      visibility: "class",
      originalKey: keys.original,
      previewKey: keys.preview,
      thumbnailKey: keys.thumbnail,
      tags: ["操场"],
      peopleIds: ["classmate-1"],
    });

    expect(submissionKeysBelongToUser("member-123", photo)).toBe(true);
    expect(submissionKeysBelongToUser("another-member", photo)).toBe(false);
  });

  it("supports member-owned MP4 video keys without accepting them as photo keys", () => {
    const id = "018f0f65-6748-7d19-9f52-111f6bc4278b";
    const keys = createMemberUploadKeys("member-123", id, "video/mp4");
    const video = memberPhotoSubmissionSchema.parse({
      id,
      title: "运动会接力",
      description: "",
      location: "操场",
      width: 1920,
      height: 1080,
      mediaType: "video",
      visibility: "class",
      originalKey: keys.original,
      previewKey: keys.preview,
      thumbnailKey: keys.thumbnail,
      tags: ["运动会"],
      peopleIds: [],
    });

    expect(keys.original.endsWith("memory.mp4")).toBe(true);
    expect(submissionKeysBelongToUser("member-123", video)).toBe(true);
    expect(submissionKeysBelongToUser("another-member", video)).toBe(false);
    expect(submissionKeysBelongToUser("member-123", { ...video, mediaType: "photo" })).toBe(false);
  });

  it("keeps image uploads at 25MB while allowing videos up to 800MB", () => {
    const shared = { name: "memory", previewSize: 10, thumbnailSize: 10 };
    expect(memberUploadSignSchema.safeParse({ ...shared, type: "image/jpeg", size: MAX_IMAGE_FILE_SIZE }).success).toBe(true);
    expect(memberUploadSignSchema.safeParse({ ...shared, type: "image/jpeg", size: MAX_IMAGE_FILE_SIZE + 1 }).success).toBe(false);
    expect(memberUploadSignSchema.safeParse({ ...shared, type: "video/mp4", size: MAX_VIDEO_FILE_SIZE }).success).toBe(true);
    expect(memberUploadSignSchema.safeParse({ ...shared, type: "video/mp4", size: MAX_VIDEO_FILE_SIZE + 1 }).success).toBe(false);
  });

  it("keeps client-side media validation aligned with upload signing", () => {
    const file = (type: string, size: number) => ({ type, size }) as File;
    expect(validateMediaFile(file("video/mp4", MAX_VIDEO_FILE_SIZE))).toBeNull();
    expect(validateMediaFile(file("video/webm", MAX_VIDEO_FILE_SIZE + 1))).toBe(
      `视频超过 ${MAX_VIDEO_FILE_SIZE_MB}MB`,
    );
    expect(validateMediaFile(file("image/jpeg", MAX_IMAGE_FILE_SIZE))).toBeNull();
    expect(validateMediaFile(file("image/png", MAX_IMAGE_FILE_SIZE + 1))).toBe(
      "图片超过 25MB",
    );
  });

  it("rejects unauthenticated upload signing before storage is reached", async () => {
    const { POST } = await import("@/app/api/uploads/sign/route");
    const response = await POST(
      new Request("http://localhost/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "memory.jpg",
          type: "image/jpeg",
          size: 10,
          previewSize: 10,
          thumbnailSize: 10,
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "只有已通过审核的班级成员可以上传照片或视频。",
    });
  });
});
