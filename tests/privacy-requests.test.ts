import { beforeEach, describe, expect, it, vi } from "vitest";

const MEMBER_ID = "member-one";
const MEDIA_ID = "018f0f65-6748-7d19-9f52-555f6bc42791";

const mocks = vi.hoisted(() => ({
  getApiMember: vi.fn(),
  getVisiblePhoto: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  readError: null as { message: string } | null,
  insertResult: {
    data: { id: "request-one", status: "pending", created_at: "2026-08-30" },
    error: null,
  } as { data: Record<string, unknown> | null; error: { code?: string } | null },
  insertRequest: vi.fn(),
  filterUserId: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiMember: mocks.getApiMember }));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/photos", () => ({ getVisiblePhoto: mocks.getVisiblePhoto }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table !== "privacy_requests") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn((column: string, value: unknown) => {
            mocks.filterUserId(column, value);
            return {
              order: vi.fn(async () => ({
                data: mocks.rows,
                error: mocks.readError,
              })),
            };
          }),
        })),
        insert: mocks.insertRequest.mockImplementation(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => mocks.insertResult),
          })),
        })),
      };
    }),
  })),
}));

describe("member privacy requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiMember.mockResolvedValue({
      id: MEMBER_ID,
      role: "member",
      status: "approved",
    });
    mocks.getVisiblePhoto.mockResolvedValue({
      id: MEDIA_ID,
      uploadedBy: "member-two",
    });
    mocks.rows = [];
    mocks.readError = null;
    mocks.insertResult = {
      data: {
        id: "request-one",
        status: "pending",
        created_at: "2026-08-30T08:00:00.000Z",
      },
      error: null,
    };
  });

  it("returns only the signed-in member's application history", async () => {
    mocks.rows = [
      {
        id: "request-one",
        photo_id: MEDIA_ID,
        kind: "hide",
        message: "希望暂时隐藏",
        status: "resolved",
        created_at: "2026-08-29T08:00:00.000Z",
        resolved_at: "2026-08-30T08:00:00.000Z",
        photos: { title: "运动会" },
      },
      {
        id: "request-two",
        photo_id: null,
        kind: "delete",
        message: "",
        status: "resolved",
        created_at: "2026-08-28T08:00:00.000Z",
        resolved_at: "2026-08-29T08:00:00.000Z",
        photos: null,
      },
    ];

    const { GET } = await import("@/app/api/privacy-requests/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.filterUserId).toHaveBeenCalledWith("user_id", MEMBER_ID);
    await expect(response.json()).resolves.toEqual({
      requests: [
        expect.objectContaining({
          id: "request-one",
          photoTitle: "运动会",
          status: "resolved",
        }),
        expect.objectContaining({
          id: "request-two",
          photoId: null,
          photoTitle: "内容已删除",
        }),
      ],
    });
  });

  it("allows an approved member to request action on any visible non-owned media", async () => {
    const { POST } = await import("@/app/api/privacy-requests/route");
    const response = await POST(
      new Request("http://localhost/api/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: MEDIA_ID,
          kind: "delete",
          message: "照片里有我",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.getVisiblePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ id: MEMBER_ID }),
      MEDIA_ID,
    );
    expect(mocks.insertRequest).toHaveBeenCalledWith({
      user_id: MEMBER_ID,
      photo_id: MEDIA_ID,
      kind: "delete",
      message: "照片里有我",
    });
  });

  it("directs uploaders to manage their own media without an application", async () => {
    mocks.getVisiblePhoto.mockResolvedValueOnce({
      id: MEDIA_ID,
      uploadedBy: MEMBER_ID,
    });
    const { POST } = await import("@/app/api/privacy-requests/route");
    const response = await POST(
      new Request("http://localhost/api/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: MEDIA_ID, kind: "hide", message: "" }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.insertRequest).not.toHaveBeenCalled();
  });
});
