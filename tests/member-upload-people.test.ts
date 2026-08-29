import { describe, expect, it, vi } from "vitest";
import { createMemberUploadKeys } from "@/lib/member-uploads";

const mocks = vi.hoisted(() => ({
  insertPeople: vi.fn(async () => ({ error: null })),
  insertPhoto: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/api-auth", () => ({
  getApiMember: vi.fn(async () => ({ id: "member-123", status: "approved", role: "member" })),
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ deleteObjects: vi.fn(async () => undefined) })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "photos") return { insert: mocks.insertPhoto };
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
    expect(mocks.insertPeople).toHaveBeenCalledWith([
      { photo_id: id, user_id: "person-one", consent_status: "approved" },
      { photo_id: id, user_id: "person-two", consent_status: "approved" },
    ]);
  });
});
