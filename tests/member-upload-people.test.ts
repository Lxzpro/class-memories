import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemberUploadKeys } from "@/lib/member-uploads";

const mocks = vi.hoisted(() => ({
  insertPeople: vi.fn(async () => ({ error: null })),
  insertPhoto: vi.fn(async () => ({ error: null })),
  publishPhoto: vi.fn(),
  publishPhotoEq: vi.fn(),
  publishPhotoIs: vi.fn(),
  publishPhotoMaybeSingle: vi.fn(async () => ({
    data: { id: "published-photo" } as { id: string } | null,
    error: null as { code?: string } | null,
  })),
  deletePhoto: vi.fn(),
  deletePhotoEq: vi.fn(),
  deletePhotoIs: vi.fn(),
  deletePhotoMaybeSingle: vi.fn(async () => ({
    data: null as { id: string } | null,
    error: null as { code?: string } | null,
  })),
  deleteObjects: vi.fn(async () => undefined),
}));

const publishBuilder = {
  eq(column: string, value: string) {
    mocks.publishPhotoEq(column, value);
    return publishBuilder;
  },
  is(column: string, value: null) {
    mocks.publishPhotoIs(column, value);
    return publishBuilder;
  },
  select() {
    return publishBuilder;
  },
  maybeSingle() {
    return mocks.publishPhotoMaybeSingle();
  },
};

const deleteBuilder = {
  eq(column: string, value: string) {
    mocks.deletePhotoEq(column, value);
    return deleteBuilder;
  },
  is(column: string, value: null) {
    mocks.deletePhotoIs(column, value);
    return deleteBuilder;
  },
  select() {
    return deleteBuilder;
  },
  maybeSingle() {
    return mocks.deletePhotoMaybeSingle();
  },
};

vi.mock("@/lib/api-auth", () => ({
  getApiMember: vi.fn(async () => ({ id: "member-123", status: "approved", role: "member" })),
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ deleteObjects: mocks.deleteObjects })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "photos") {
        return {
          insert: mocks.insertPhoto,
          update: mocks.publishPhoto.mockImplementation(() => publishBuilder),
          delete: mocks.deletePhoto.mockImplementation(() => deleteBuilder),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [
                  { id: "person-one" },
                  { id: "person-two" },
                ],
              })),
            })),
          })),
        };
      }
      if (table === "photo_people") return { insert: mocks.insertPeople };
      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

describe("member upload people associations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertPhoto.mockResolvedValue({ error: null });
    mocks.publishPhotoMaybeSingle.mockResolvedValue({
      data: { id: "published-photo" },
      error: null,
    });
    mocks.deletePhotoMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("creates tagged classmate associations without confirmation", async () => {
    const id = "018f0f65-6748-7d19-9f52-111f6bc4278c";
    const keys = createMemberUploadKeys("member-123", id, "video/mp4");
    const { POST } = await import("@/app/api/photos/route");
    const response = await POST(new Request("http://localhost/api/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        tags: [],
        peopleIds: ["person-one", "person-two"],
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.insertPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        review_status: "draft",
        uploaded_by: "member-123",
      }),
    );
    expect(mocks.insertPeople).toHaveBeenCalledWith([
      { photo_id: id, user_id: "person-one", consent_status: "approved" },
      { photo_id: id, user_id: "person-two", consent_status: "approved" },
    ]);
    expect(mocks.publishPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ review_status: "published" }),
    );
    expect(mocks.publishPhotoEq).toHaveBeenCalledWith("id", id);
    expect(mocks.publishPhotoEq).toHaveBeenCalledWith("uploaded_by", "member-123");
    expect(mocks.publishPhotoEq).toHaveBeenCalledWith("review_status", "draft");
    expect(mocks.publishPhotoIs).toHaveBeenCalledWith("deleted_at", null);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        photo: expect.objectContaining({
          id,
          reviewStatus: "published",
        }),
      }),
    );
  });

  it("does not publish or clean up storage when the draft changed concurrently", async () => {
    const id = "018f0f65-6748-7d19-9f52-111f6bc4278c";
    const keys = createMemberUploadKeys("member-123", id, "video/mp4");
    mocks.publishPhotoMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { POST } = await import("@/app/api/photos/route");
    const response = await POST(
      new Request("http://localhost/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          tags: [],
          peopleIds: [],
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "媒体状态已发生变化，本次发布已取消。",
    });
    expect(mocks.deletePhotoEq).toHaveBeenCalledWith("id", id);
    expect(mocks.deletePhotoEq).toHaveBeenCalledWith("uploaded_by", "member-123");
    expect(mocks.deletePhotoEq).toHaveBeenCalledWith("review_status", "draft");
    expect(mocks.deletePhotoIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
  });

  it("never deletes storage objects when a repeated submission hits a unique constraint", async () => {
    const id = "018f0f65-6748-7d19-9f52-111f6bc4278c";
    const keys = createMemberUploadKeys("member-123", id, "video/mp4");
    mocks.insertPhoto.mockResolvedValueOnce({
      error: { code: "23505" } as never,
    });

    const { POST } = await import("@/app/api/photos/route");
    const response = await POST(
      new Request("http://localhost/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          tags: [],
          peopleIds: ["person-one"],
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "这份媒体已经发布，请不要重复提交。",
    });
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.insertPeople).not.toHaveBeenCalled();
    expect(mocks.publishPhoto).not.toHaveBeenCalled();
  });
});
