import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/types/domain";

const PHOTO_ID = "018f0f65-6748-7d19-9f52-777f6bc42791";
const CREATED_AT = "2026-08-30T09:00:00.000Z";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getVisiblePhoto: vi.fn(),
  getPhotoComments: vi.fn(),
  insertComment: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/photos", () => ({
  getVisiblePhoto: mocks.getVisiblePhoto,
  getPhotoComments: mocks.getPhotoComments,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table !== "comments") throw new Error(`Unexpected table: ${table}`);
      return {
        insert: mocks.insertComment.mockImplementation(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: "comment-one", created_at: CREATED_AT },
              error: null,
            })),
          })),
        })),
      };
    }),
  })),
}));

const baseUser: Profile = {
  id: "member-one",
  email: "member@example.com",
  displayName: "小夏",
  realName: "夏宁",
  avatarKey: null,
  role: "member",
  status: "approved",
  showRealName: true,
  allowOriginalDownload: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function postComment(user: Profile) {
  mocks.getCurrentUser.mockResolvedValueOnce(user);
  const { POST } = await import("@/app/api/photos/[id]/comments/route");
  return POST(
    new Request(`http://localhost/api/photos/${PHOTO_ID}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "这一刻真好" }),
    }),
    { params: Promise.resolve({ id: PHOTO_ID }) },
  );
}

describe("comment author public identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVisiblePhoto.mockResolvedValue({
      id: PHOTO_ID,
      uploadedBy: "another-member",
    });
  });

  it.each([
    {
      scenario: "uses the real name after the member opts in",
      user: baseUser,
      expectedName: "夏宁",
    },
    {
      scenario: "uses the nickname when real-name display is disabled",
      user: { ...baseUser, showRealName: false },
      expectedName: "小夏",
    },
    {
      scenario: "falls back to the nickname when no real name exists",
      user: { ...baseUser, realName: null },
      expectedName: "小夏",
    },
  ])("$scenario", async ({ user, expectedName }) => {
    const response = await postComment(user);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      comment: {
        id: "comment-one",
        photoId: PHOTO_ID,
        userId: baseUser.id,
        authorName: expectedName,
        content: "这一刻真好",
        status: "visible",
        createdAt: CREATED_AT,
      },
    });
    expect(mocks.getVisiblePhoto).toHaveBeenCalledWith(user, PHOTO_ID);
    expect(mocks.insertComment).toHaveBeenCalledWith({
      photo_id: PHOTO_ID,
      user_id: baseUser.id,
      content: "这一刻真好",
      status: "visible",
    });
  });
});
