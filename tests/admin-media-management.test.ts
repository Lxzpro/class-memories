import { beforeEach, describe, expect, it, vi } from "vitest";

const MEDIA_ID = "018f0f65-6748-7d19-9f52-222f6bc42791";

type DatabaseError = { message: string } | null;
type DatabaseResult = { data?: unknown; error: DatabaseError };

const mocks = vi.hoisted(() => ({
  getApiAdmin: vi.fn(),
  writeAdminLog: vi.fn(async () => undefined),
  photoRow: null as Record<string, unknown> | null,
  readError: null as DatabaseError,
  updateResults: [] as DatabaseResult[],
  updateIndex: 0,
  updatePhoto: vi.fn(),
  updateEq: vi.fn(),
  relationDelete: vi.fn(),
  relationDeleteError: null as DatabaseError,
  deleteObjects: vi.fn(async () => undefined),
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
  type Builder = {
    eq: (column: string, value: unknown) => Builder;
    neq: (column: string, value: unknown) => Builder;
    in: (column: string, values: unknown[]) => Builder;
    select: (...columns: string[]) => Builder;
    single: () => Promise<DatabaseResult>;
    maybeSingle: () => Promise<DatabaseResult>;
    then: <TResult1 = DatabaseResult, TResult2 = never>(
      onfulfilled?:
        | ((value: DatabaseResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ) => Promise<TResult1 | TResult2>;
  };

  function makeBuilder(
    result: () => DatabaseResult,
    onEq?: (column: string, value: unknown) => void,
  ): Builder {
    const builder: Builder = {
      eq(column, value) {
        onEq?.(column, value);
        return builder;
      },
      neq() {
        return builder;
      },
      in() {
        return builder;
      },
      select() {
        return builder;
      },
      single: vi.fn(async () => result()),
      maybeSingle: vi.fn(async () => result()),
      then(onfulfilled, onrejected) {
        return Promise.resolve(result()).then(onfulfilled, onrejected);
      },
    };
    return builder;
  }

  return {
    createSupabaseAdminClient: vi.fn(async () => ({
      from: vi.fn((table: string) => {
        if (table === "photos") {
          return {
            select: vi.fn(() =>
              makeBuilder(() => ({
                data: mocks.photoRow,
                error: mocks.readError,
              })),
            ),
            update: mocks.updatePhoto.mockImplementation(() => {
              const result =
                mocks.updateResults[mocks.updateIndex++] ?? {
                  data: null,
                  error: null,
                };
              return makeBuilder(() => result, mocks.updateEq);
            }),
          };
        }
        if (table === "photo_people") {
          return {
            delete: mocks.relationDelete.mockImplementation(() =>
              makeBuilder(() => ({
                error: mocks.relationDeleteError,
              })),
            ),
            insert: vi.fn(async () => ({ error: null })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    })),
  };
});

function patchMedia(body: unknown) {
  return import("@/app/api/admin/photos/[id]/route").then(({ PATCH }) =>
    PATCH(
      new Request(`http://localhost/api/admin/photos/${MEDIA_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: MEDIA_ID }) },
    ),
  );
}

function deleteMedia(body?: unknown) {
  return import("@/app/api/admin/photos/[id]/route").then(({ DELETE }) =>
    DELETE(
      new Request(`http://localhost/api/admin/photos/${MEDIA_ID}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: MEDIA_ID }) },
    ),
  );
}

describe("administrator photo and video management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiAdmin.mockResolvedValue({ id: "admin-one", role: "admin" });
    mocks.photoRow = {
      id: MEDIA_ID,
      review_status: "published",
      original_key: `originals/member/${MEDIA_ID}/memory.mp4`,
      preview_key: `previews/member/${MEDIA_ID}/preview.webp`,
      thumbnail_key: `thumbnails/member/${MEDIA_ID}/thumbnail.webp`,
    };
    mocks.readError = null;
    mocks.updateResults = [];
    mocks.updateIndex = 0;
    mocks.relationDeleteError = null;
  });

  it("keeps media hidden when a relationship replacement fails", async () => {
    mocks.updateResults = [{ data: { id: MEDIA_ID }, error: null }];
    mocks.relationDeleteError = { message: "relation delete failed" };

    const response = await patchMedia({
      peopleIds: [],
      reviewStatus: "published",
    });

    expect(response.status).toBe(500);
    expect(mocks.updatePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.updatePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ review_status: "hidden" }),
    );
    expect(mocks.updatePhoto.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.relationDelete.mock.invocationCallOrder[0],
    );
    expect(mocks.writeAdminLog).not.toHaveBeenCalled();
  });

  it("restores the requested status only after relationships succeed", async () => {
    mocks.updateResults = [
      { data: { id: MEDIA_ID }, error: null },
      { data: { id: MEDIA_ID }, error: null },
    ];

    const response = await patchMedia({
      peopleIds: [],
      reviewStatus: "published",
    });

    expect(response.status).toBe(200);
    expect(mocks.updatePhoto).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ review_status: "hidden" }),
    );
    expect(mocks.updatePhoto).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ review_status: "published" }),
    );
    expect(mocks.relationDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updatePhoto.mock.invocationCallOrder[1],
    );
  });

  it("does not delete R2 objects when the database delete fails", async () => {
    mocks.updateResults = [
      { data: null, error: { message: "database update failed" } },
    ];

    const response = await deleteMedia();

    expect(response.status).toBe(500);
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.writeAdminLog).not.toHaveBeenCalled();
  });

  it("deletes only database-sourced storage keys after the database update", async () => {
    mocks.updateResults = [{ data: { id: MEDIA_ID }, error: null }];

    const response = await deleteMedia({
      originalKey: "originals/attacker/other.mp4",
      previewKey: "previews/attacker/other.webp",
      thumbnailKey: "thumbnails/attacker/other.webp",
    });

    expect(response.status).toBe(200);
    expect(mocks.updatePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: "deleted",
        deleted_at: expect.any(String),
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith("id", MEDIA_ID);
    expect(mocks.deleteObjects).toHaveBeenCalledWith([
      mocks.photoRow!.original_key,
      mocks.photoRow!.preview_key,
      mocks.photoRow!.thumbnail_key,
    ]);
    expect(mocks.updatePhoto.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObjects.mock.invocationCallOrder[0],
    );
  });
});
