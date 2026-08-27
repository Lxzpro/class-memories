import { describe, expect, it, vi } from "vitest";
import {
  createMemberUploadKeys,
  memberPhotoSubmissionSchema,
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
      visibility: "class",
      originalKey: keys.original,
      previewKey: keys.preview,
      thumbnailKey: keys.thumbnail,
      tags: ["操场"],
    });

    expect(submissionKeysBelongToUser("member-123", photo)).toBe(true);
    expect(submissionKeysBelongToUser("another-member", photo)).toBe(false);
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
      error: "只有已通过审核的班级成员可以上传照片。",
    });
  });
});
