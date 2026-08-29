import { beforeEach, describe, expect, it, vi } from "vitest";

const MEDIA_ID = "018f0f65-6748-7d19-9f52-333f6bc42791";
const OWNER_ID = "member-owner";
const OTHER_ID = "member-other";

const mocks = vi.hoisted(() => ({
  getApiMember: vi.fn(),
  canDownloadOriginal: vi.fn(),
  getVisiblePhoto: vi.fn(),
  createReadUrl: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  maybeSingle: vi.fn(),
  mediaRow: null as {
    title: string;
    original_key: string;
    uploaded_by: string;
  } | null,
}));

vi.mock("@/lib/api-auth", () => ({ getApiMember: mocks.getApiMember }));
vi.mock("@/lib/authz", () => ({
  canDownloadOriginal: mocks.canDownloadOriginal,
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/mock-data", () => ({ MOCK_PHOTOS: [] }));
vi.mock("@/lib/photos", () => ({ getVisiblePhoto: mocks.getVisiblePhoto }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ createReadUrl: mocks.createReadUrl })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

async function downloadMedia() {
  const { GET } = await import("@/app/api/photos/[id]/download/route");
  return GET(
    new Request(`http://localhost/api/photos/${MEDIA_ID}/download`),
    { params: Promise.resolve({ id: MEDIA_ID }) },
  );
}

describe("photo and video original download authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaRow = {
      title: "运动会视频",
      original_key: `originals/${OWNER_ID}/${MEDIA_ID}/relay.mp4`,
      uploaded_by: OWNER_ID,
    };
    mocks.maybeSingle.mockImplementation(async () => ({
      data: mocks.mediaRow,
      error: null,
    }));
    mocks.neq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.eq.mockReturnValue({ neq: mocks.neq });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.createSupabaseAdminClient.mockResolvedValue({ from: mocks.from });
    mocks.createReadUrl.mockResolvedValue(
      "https://media.example/signed-original",
    );
    mocks.getVisiblePhoto.mockResolvedValue(null);
    mocks.canDownloadOriginal.mockReturnValue(false);
  });

  it("lets the uploader retrieve a hidden original even when downloads are disabled", async () => {
    mocks.getApiMember.mockResolvedValue({
      id: OWNER_ID,
      role: "member",
      status: "approved",
    });

    const response = await downloadMedia();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://media.example/signed-original",
    );
    expect(mocks.eq).toHaveBeenCalledWith("id", MEDIA_ID);
    expect(mocks.neq).toHaveBeenCalledWith("review_status", "deleted");
    expect(mocks.getVisiblePhoto).not.toHaveBeenCalled();
    expect(mocks.canDownloadOriginal).not.toHaveBeenCalled();
    expect(mocks.createReadUrl).toHaveBeenCalledWith({
      key: mocks.mediaRow!.original_key,
      expiresIn: 60,
      downloadName: "运动会视频.mp4",
    });
  });

  it("lets an administrator retrieve any non-deleted media original", async () => {
    mocks.mediaRow = {
      ...mocks.mediaRow!,
      uploaded_by: OTHER_ID,
    };
    mocks.getApiMember.mockResolvedValue({
      id: "admin-one",
      role: "admin",
      status: "approved",
    });

    const response = await downloadMedia();

    expect(response.status).toBe(302);
    expect(mocks.getVisiblePhoto).not.toHaveBeenCalled();
    expect(mocks.canDownloadOriginal).not.toHaveBeenCalled();
    expect(mocks.createReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: mocks.mediaRow.original_key }),
    );
  });

  it("requires an ordinary non-uploader to pass visibility and download checks before signing", async () => {
    const user = {
      id: OTHER_ID,
      role: "member",
      status: "approved",
    };
    const visiblePhoto = { id: MEDIA_ID, downloadAllowed: false };
    mocks.getApiMember.mockResolvedValue(user);
    mocks.getVisiblePhoto.mockResolvedValue(visiblePhoto);
    mocks.canDownloadOriginal.mockReturnValue(false);

    const response = await downloadMedia();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "无权下载这份原始文件。",
    });
    expect(mocks.getVisiblePhoto).toHaveBeenCalledWith(user, MEDIA_ID);
    expect(mocks.canDownloadOriginal).toHaveBeenCalledWith(
      user,
      visiblePhoto,
    );
    expect(mocks.createReadUrl).not.toHaveBeenCalled();
  });
});
