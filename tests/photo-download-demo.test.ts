import { beforeEach, describe, expect, it, vi } from "vitest";

const DEMO_MEDIA_ID = "photo-owner-hidden";

const mocks = vi.hoisted(() => ({
  getApiMember: vi.fn(),
  createReadUrl: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getVisiblePhoto: vi.fn(),
  canDownloadOriginal: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiMember: mocks.getApiMember }));
vi.mock("@/lib/authz", () => ({
  canDownloadOriginal: mocks.canDownloadOriginal,
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: true }));
vi.mock("@/lib/mock-data", () => ({
  MOCK_PHOTOS: [
    {
      id: DEMO_MEDIA_ID,
      title: "自己的隐藏照片",
      originalKey: "originals/user-member/hidden-memory.jpg",
      uploadedBy: "user-member",
      reviewStatus: "hidden",
      downloadAllowed: false,
    },
  ],
}));
vi.mock("@/lib/photos", () => ({ getVisiblePhoto: mocks.getVisiblePhoto }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ createReadUrl: mocks.createReadUrl })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("demo original download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiMember.mockResolvedValue({
      id: "user-member",
      role: "member",
      status: "approved",
    });
    mocks.createReadUrl.mockResolvedValue("https://media.example/demo-signed");
  });

  it("uses mock media without creating a Supabase client", async () => {
    const { GET } = await import("@/app/api/photos/[id]/download/route");

    const response = await GET(
      new Request(
        `http://localhost/api/photos/${DEMO_MEDIA_ID}/download`,
      ),
      { params: Promise.resolve({ id: DEMO_MEDIA_ID }) },
    );

    expect(response.status).toBe(302);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.getVisiblePhoto).not.toHaveBeenCalled();
    expect(mocks.canDownloadOriginal).not.toHaveBeenCalled();
    expect(mocks.createReadUrl).toHaveBeenCalledWith({
      key: "originals/user-member/hidden-memory.jpg",
      expiresIn: 60,
      downloadName: "自己的隐藏照片.jpg",
    });
  });
});
