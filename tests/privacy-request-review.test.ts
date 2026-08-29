import { beforeEach, describe, expect, it, vi } from "vitest";

const REQUEST_ID = "018f0f65-6748-7d19-9f52-333f6bc42791";
const MEDIA_ID = "018f0f65-6748-7d19-9f52-444f6bc42791";

type DatabaseError = { message: string; code?: string } | null;
type DatabaseResult = { data: unknown; error: DatabaseError };

const mocks = vi.hoisted(() => ({
  getApiAdmin: vi.fn(),
  writeAdminLog: vi.fn(async () => undefined),
  claimResult: { data: null, error: null } as DatabaseResult,
  leaseResult: { data: { id: "request" }, error: null } as DatabaseResult,
  releaseResult: { data: null, error: null } as DatabaseResult,
  finalizeResult: { data: { id: "request" }, error: null } as DatabaseResult,
  photoRow: null as Record<string, unknown> | null,
  photoReadError: null as DatabaseError,
  hideResult: { data: { id: "photo" }, error: null } as DatabaseResult,
  deleteResult: { data: { id: "photo" }, error: null } as DatabaseResult,
  updatePrivacy: vi.fn(),
  selectPrivacy: vi.fn(),
  updatePhoto: vi.fn(),
  selectPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  deleteObjects: vi.fn(async () => undefined),
  claimEq: vi.fn(),
  claimOr: vi.fn(),
  leaseEq: vi.fn(),
  releaseEq: vi.fn(),
  finalizeEq: vi.fn(),
  photoEq: vi.fn(),
  photoNeq: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiAdmin: mocks.getApiAdmin }));
vi.mock("@/lib/admin-audit", () => ({
  writeAdminLog: mocks.writeAdminLog,
}));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ deleteObjects: mocks.deleteObjects })),
}));
vi.mock("@/lib/supabase/server", () => {
  type BuilderHooks = {
    eq?: (column: string, value: unknown) => void;
    neq?: (column: string, value: unknown) => void;
    or?: (filter: string) => void;
  };
  type Builder = PromiseLike<DatabaseResult> & {
    eq: (column: string, value: unknown) => Builder;
    neq: (column: string, value: unknown) => Builder;
    or: (filter: string) => Builder;
    select: (...columns: string[]) => Builder;
    maybeSingle: () => Promise<DatabaseResult>;
  };

  function builder(
    result: () => DatabaseResult,
    hooks: BuilderHooks = {},
  ): Builder {
    const chain: Builder = {
      eq(column, value) {
        hooks.eq?.(column, value);
        return chain;
      },
      neq(column, value) {
        hooks.neq?.(column, value);
        return chain;
      },
      or(filter) {
        hooks.or?.(filter);
        return chain;
      },
      select() {
        return chain;
      },
      maybeSingle: vi.fn(async () => result()),
      then(onfulfilled, onrejected) {
        return Promise.resolve(result()).then(onfulfilled, onrejected);
      },
    };
    return chain;
  }

  return {
    createSupabaseAdminClient: vi.fn(async () => ({
      from: vi.fn((table: string) => {
        if (table === "privacy_requests") {
          return {
            select: mocks.selectPrivacy.mockImplementation(() =>
              builder(() => mocks.leaseResult, {
                eq: mocks.leaseEq,
              }),
            ),
            update: mocks.updatePrivacy.mockImplementation(
              (payload: Record<string, unknown>) => {
                if (
                  payload.processing_by !== null &&
                  !Object.hasOwn(payload, "status")
                ) {
                  return builder(() => mocks.claimResult, {
                    eq: mocks.claimEq,
                    or: mocks.claimOr,
                  });
                }
                if (Object.hasOwn(payload, "status")) {
                  return builder(() => mocks.finalizeResult, {
                    eq: mocks.finalizeEq,
                  });
                }
                return builder(() => mocks.releaseResult, {
                  eq: mocks.releaseEq,
                });
              },
            ),
          };
        }
        if (table === "photos") {
          return {
            select: mocks.selectPhoto.mockImplementation(() =>
              builder(
                () => ({
                  data: mocks.photoRow,
                  error: mocks.photoReadError,
                }),
                { eq: mocks.photoEq },
              ),
            ),
            update: mocks.updatePhoto.mockImplementation(() =>
              builder(() => mocks.hideResult, {
                eq: mocks.photoEq,
                neq: mocks.photoNeq,
              }),
            ),
            delete: mocks.deletePhoto.mockImplementation(() =>
              builder(() => mocks.deleteResult, { eq: mocks.photoEq }),
            ),
          };
        }
        throw new Error("Unexpected table: " + table);
      }),
    })),
  };
});

function review(status: "resolved" | "rejected") {
  return import("@/app/api/admin/privacy-requests/[id]/review/route").then(
    ({ POST }) =>
      POST(
        new Request(
          "http://localhost/api/admin/privacy-requests/" +
            REQUEST_ID +
            "/review",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          },
        ),
        { params: Promise.resolve({ id: REQUEST_ID }) },
      ),
  );
}

describe("administrator privacy request review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiAdmin.mockResolvedValue({ id: "admin-one", role: "admin" });
    mocks.claimResult = {
      data: {
        photo_id: MEDIA_ID,
        kind: "hide",
        status: "pending",
      },
      error: null,
    };
    mocks.leaseResult = {
      data: { id: REQUEST_ID },
      error: null,
    };
    mocks.releaseResult = { data: null, error: null };
    mocks.finalizeResult = {
      data: { id: REQUEST_ID },
      error: null,
    };
    mocks.photoRow = {
      id: MEDIA_ID,
      original_key: "originals/member/" + MEDIA_ID + "/memory.mp4",
      preview_key: "previews/member/" + MEDIA_ID + "/preview.webp",
      thumbnail_key: "thumbnails/member/" + MEDIA_ID + "/thumbnail.webp",
    };
    mocks.photoReadError = null;
    mocks.hideResult = { data: { id: MEDIA_ID }, error: null };
    mocks.deleteResult = { data: { id: MEDIA_ID }, error: null };
    mocks.deleteObjects.mockResolvedValue(undefined);
  });

  it("claims a pending request atomically before hiding its content", async () => {
    const response = await review("resolved");
    const claimPayload = mocks.updatePrivacy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const claimToken = claimPayload.processing_token;

    expect(response.status).toBe(200);
    expect(mocks.updatePrivacy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        processing_at: expect.any(String),
        processing_by: "admin-one",
        processing_token: expect.any(String),
      }),
    );
    expect(claimToken).not.toBe("");
    expect(mocks.claimEq).toHaveBeenCalledWith("id", REQUEST_ID);
    expect(mocks.claimEq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.claimOr).toHaveBeenCalledWith(
      expect.stringMatching(
        /^processing_at\.is\.null,processing_at\.lt\./,
      ),
    );
    expect(mocks.leaseEq).toHaveBeenCalledWith("id", REQUEST_ID);
    expect(mocks.leaseEq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.leaseEq).toHaveBeenCalledWith("processing_by", "admin-one");
    expect(mocks.leaseEq).toHaveBeenCalledWith(
      "processing_token",
      claimToken,
    );
    expect(mocks.updatePhoto).toHaveBeenCalledWith({
      review_status: "hidden",
    });
    expect(mocks.photoNeq).toHaveBeenCalledWith(
      "review_status",
      "deleted",
    );
    expect(mocks.deletePhoto).not.toHaveBeenCalled();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.updatePrivacy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "resolved",
        processing_at: null,
        processing_by: null,
        processing_token: null,
      }),
    );
    expect(mocks.finalizeEq).toHaveBeenCalledWith(
      "processing_token",
      claimToken,
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        effect: "hidden",
        photoHidden: true,
        photoDeleted: false,
      }),
    );
  });

  it("hides first, deletes R2 objects second, and removes the database row last", async () => {
    mocks.claimResult = {
      data: {
        photo_id: MEDIA_ID,
        kind: "delete",
        status: "pending",
      },
      error: null,
    };

    const response = await review("resolved");

    expect(response.status).toBe(200);
    expect(mocks.updatePhoto).toHaveBeenCalledWith({
      review_status: "hidden",
    });
    expect(mocks.deleteObjects).toHaveBeenCalledWith([
      mocks.photoRow!.original_key,
      mocks.photoRow!.preview_key,
      mocks.photoRow!.thumbnail_key,
    ]);
    expect(mocks.deletePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.updatePhoto.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObjects.mock.invocationCallOrder[0],
    );
    expect(mocks.deleteObjects.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deletePhoto.mock.invocationCallOrder[0],
    );
    expect(mocks.writeAdminLog).toHaveBeenCalledWith(
      "admin-one",
      "privacy_request_resolved",
      "privacy_request",
      REQUEST_ID,
      expect.objectContaining({
        kind: "delete",
        effect: "deleted",
        photoDeleted: true,
      }),
    );
  });

  it("returns 502 on R2 failure, keeps the database row, and releases the claim", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.claimResult = {
      data: {
        photo_id: MEDIA_ID,
        kind: "delete",
        status: "pending",
      },
      error: null,
    };
    mocks.deleteObjects.mockRejectedValueOnce(new Error("R2 unavailable"));

    const response = await review("resolved");
    errorSpy.mockRestore();
    const claimPayload = mocks.updatePrivacy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const claimToken = claimPayload.processing_token;

    expect(response.status).toBe(502);
    expect(mocks.updatePhoto).toHaveBeenCalledWith({
      review_status: "hidden",
    });
    expect(mocks.deletePhoto).not.toHaveBeenCalled();
    expect(mocks.updatePrivacy).toHaveBeenCalledWith({
      processing_at: null,
      processing_by: null,
      processing_token: null,
    });
    expect(mocks.releaseEq).toHaveBeenCalledWith("id", REQUEST_ID);
    expect(mocks.releaseEq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.releaseEq).toHaveBeenCalledWith(
      "processing_by",
      "admin-one",
    );
    expect(mocks.releaseEq).toHaveBeenCalledWith(
      "processing_token",
      claimToken,
    );
    expect(mocks.updatePrivacy).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "resolved" }),
    );
    await expect(response.json()).resolves.toEqual({
      error: "云端文件清理失败，内容已先隐藏；请稍后安全重试。",
      storageCleanupPending: true,
    });
  });

  it("returns 409 without touching media when another administrator owns the claim", async () => {
    mocks.claimResult = { data: null, error: null };

    const response = await review("resolved");

    expect(response.status).toBe(409);
    expect(mocks.updatePrivacy).toHaveBeenCalledTimes(1);
    expect(mocks.updatePhoto).not.toHaveBeenCalled();
    expect(mocks.selectPhoto).not.toHaveBeenCalled();
    expect(mocks.deletePhoto).not.toHaveBeenCalled();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.writeAdminLog).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "申请正在由其他管理员处理，或已经处理完成。",
    });
  });

  it("returns 409 without modifying media when the acquired lease is no longer owned", async () => {
    mocks.leaseResult = { data: null, error: null };

    const response = await review("resolved");
    const claimPayload = mocks.updatePrivacy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const claimToken = claimPayload.processing_token;

    expect(response.status).toBe(409);
    expect(mocks.selectPrivacy).toHaveBeenCalledWith("id");
    expect(mocks.leaseEq).toHaveBeenCalledWith(
      "processing_token",
      claimToken,
    );
    expect(mocks.updatePhoto).not.toHaveBeenCalled();
    expect(mocks.selectPhoto).not.toHaveBeenCalled();
    expect(mocks.deletePhoto).not.toHaveBeenCalled();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.updatePrivacy).toHaveBeenCalledWith({
      processing_at: null,
      processing_by: null,
      processing_token: null,
    });
    expect(mocks.releaseEq).toHaveBeenCalledWith(
      "processing_token",
      claimToken,
    );
    await expect(response.json()).resolves.toEqual({
      error: "本次处理租约已失效，请刷新后重试。",
    });
  });

  it("rejects after claiming without modifying any media", async () => {
    const response = await review("rejected");
    const claimPayload = mocks.updatePrivacy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const claimToken = claimPayload.processing_token;

    expect(response.status).toBe(200);
    expect(mocks.updatePhoto).not.toHaveBeenCalled();
    expect(mocks.selectPhoto).not.toHaveBeenCalled();
    expect(mocks.deletePhoto).not.toHaveBeenCalled();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.updatePrivacy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        processing_at: null,
        processing_by: null,
        processing_token: null,
      }),
    );
    expect(mocks.finalizeEq).toHaveBeenCalledWith(
      "processing_token",
      claimToken,
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        effect: "none",
        photoHidden: false,
        photoDeleted: false,
      }),
    );
  });
});
