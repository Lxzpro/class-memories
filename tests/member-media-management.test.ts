import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "member-owner";
const OTHER_ID = "member-other";
const MEDIA_ID = "018f0f65-6748-7d19-9f52-111f6bc42791";

type MediaRow = {
  id: string;
  uploaded_by: string;
  review_status: "published" | "hidden" | "deleted";
  original_key: string;
  preview_key: string;
  thumbnail_key: string;
};

const mocks = vi.hoisted(() => ({
  getApiMember: vi.fn(),
  selectedMedia: null as MediaRow | null,
  updatedMedia: null as MediaRow | null,
  selectEq: vi.fn(),
  updateEq: vi.fn(),
  updatePhoto: vi.fn(),
  deleteObjects: vi.fn(async () => undefined),
  deleteRelation: vi.fn(),
  relationDeleteError: null as { code: string } | null,
  insertRelation: vi.fn(async () => ({ error: null })),
  upsertTag: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ getApiMember: mocks.getApiMember }));
vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/mock-data", () => ({ MOCK_PHOTOS: [] }));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({ deleteObjects: mocks.deleteObjects })),
}));
vi.mock("@/lib/supabase/server", () => {
  type DatabaseResult = {
    data?: unknown;
    error: { code?: string } | null;
  };
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
    singleResult = result,
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
      single: vi.fn(async () => singleResult()),
      maybeSingle: vi.fn(async () => singleResult()),
      then(onfulfilled, onrejected) {
        return Promise.resolve(result()).then(onfulfilled, onrejected);
      },
    };
    return builder;
  }

  function selectedMediaResult(): DatabaseResult {
    const ownerFilter = mocks.selectEq.mock.calls.find(
      ([column]) => column === "uploaded_by",
    )?.[1];
    const idFilter = mocks.selectEq.mock.calls.find(
      ([column]) => column === "id",
    )?.[1];
    const media = mocks.selectedMedia;
    const matches =
      media &&
      (ownerFilter === undefined || ownerFilter === media.uploaded_by) &&
      (idFilter === undefined || idFilter === media.id);
    return { data: matches ? media : null, error: null };
  }

  function updatedMediaResult(asArray: boolean): DatabaseResult {
    return {
      data: asArray
        ? mocks.updatedMedia
          ? [mocks.updatedMedia]
          : []
        : mocks.updatedMedia,
      error: null,
    };
  }

  return {
    createSupabaseAdminClient: vi.fn(async () => ({
      from: vi.fn((table: string) => {
        if (table === "photos") {
          return {
            select: vi.fn(() =>
              makeBuilder(
                selectedMediaResult,
                selectedMediaResult,
                mocks.selectEq,
              ),
            ),
            update: mocks.updatePhoto.mockImplementation(() =>
              makeBuilder(
                () => updatedMediaResult(true),
                () => updatedMediaResult(false),
                mocks.updateEq,
              ),
            ),
          };
        }
        if (table === "photo_people" || table === "photo_tags") {
          return {
            delete: mocks.deleteRelation.mockImplementation(() =>
              makeBuilder(() => ({ error: mocks.relationDeleteError })),
            ),
            insert: mocks.insertRelation,
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn(() =>
              makeBuilder(() => ({
                data: [{ id: "classmate-one" }],
                error: null,
              })),
            ),
          };
        }
        if (table === "tags") {
          return {
            upsert: mocks.upsertTag.mockImplementation(() =>
              makeBuilder(
                () => ({ data: { id: "tag-one" }, error: null }),
              ),
            ),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    })),
  };
});

function patchMedia(body: unknown) {
  return import("@/app/api/photos/[id]/route").then(({ PATCH }) =>
    PATCH(
      new Request(`http://localhost/api/photos/${MEDIA_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: MEDIA_ID }) },
    ),
  );
}

function deleteMedia(body?: unknown) {
  return import("@/app/api/photos/[id]/route").then(({ DELETE }) =>
    DELETE(
      new Request(`http://localhost/api/photos/${MEDIA_ID}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: MEDIA_ID }) },
    ),
  );
}

describe("member-owned photo and video management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiMember.mockResolvedValue({
      id: OWNER_ID,
      role: "member",
      status: "approved",
    });
    mocks.selectedMedia = {
      id: MEDIA_ID,
      uploaded_by: OWNER_ID,
      review_status: "published",
      original_key: `originals/${OWNER_ID}/${MEDIA_ID}/memory.jpg`,
      preview_key: `previews/${OWNER_ID}/${MEDIA_ID}/preview.webp`,
      thumbnail_key: `thumbnails/${OWNER_ID}/${MEDIA_ID}/thumbnail.webp`,
    };
    mocks.updatedMedia = { ...mocks.selectedMedia };
    mocks.relationDeleteError = null;
  });

  it.each([
    ["photo", "memory.jpg"],
    ["video", "memory.mp4"],
  ])("uses the same owner-only update contract for %s media", async (_kind, fileName) => {
    mocks.selectedMedia = {
      ...mocks.selectedMedia!,
      original_key: `originals/${OWNER_ID}/${MEDIA_ID}/${fileName}`,
    };
    mocks.updatedMedia = { ...mocks.selectedMedia };

    const response = await patchMedia({
      action: "update",
      title: "运动会接力",
      description: "最后一棒冲过终点。",
      location: "操场",
      visibility: "private",
      downloadAllowed: true,
      tags: ["运动会"],
      peopleIds: ["classmate-one"],
    });

    expect(response.status).toBe(200);
    expect(mocks.updatePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "运动会接力",
        description: "最后一棒冲过终点。",
        location: "操场",
        visibility: "private",
        download_allowed: true,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith("id", MEDIA_ID);
    expect(mocks.updateEq).toHaveBeenCalledWith("uploaded_by", OWNER_ID);
  });

  it.each(["hidden", "published"] as const)(
    "lets the owner set review status to %s",
    async (reviewStatus) => {
      mocks.updatedMedia = {
        ...mocks.selectedMedia!,
        review_status: reviewStatus,
      };

      const response = await patchMedia({
        action: "setStatus",
        reviewStatus,
      });

      expect(response.status).toBe(200);
      expect(mocks.updatePhoto).toHaveBeenCalledWith(
        expect.objectContaining({ review_status: reviewStatus }),
      );
      expect(mocks.updateEq).toHaveBeenCalledWith("id", MEDIA_ID);
      expect(mocks.updateEq).toHaveBeenCalledWith("uploaded_by", OWNER_ID);
    },
  );

  it("returns 404 when patching media owned by another member", async () => {
    mocks.selectedMedia = {
      ...mocks.selectedMedia!,
      uploaded_by: OTHER_ID,
    };
    mocks.updatedMedia = null;

    const response = await patchMedia({
      action: "setStatus",
      reviewStatus: "hidden",
    });

    expect(response.status).toBe(404);
    if (mocks.updatePhoto.mock.calls.length > 0) {
      expect(mocks.updateEq).toHaveBeenCalledWith("id", MEDIA_ID);
      expect(mocks.updateEq).toHaveBeenCalledWith("uploaded_by", OWNER_ID);
    }
  });

  it("rejects visibility modes outside the member contract", async () => {
    const response = await patchMedia({
      action: "update",
      title: "运动会接力",
      description: "",
      location: "操场",
      visibility: "selected",
      downloadAllowed: false,
      tags: [],
      peopleIds: [],
    });

    expect(response.status).toBe(400);
    expect(mocks.updatePhoto).not.toHaveBeenCalled();
  });

  it("hides owner media before a relationship update can fail", async () => {
    mocks.relationDeleteError = { code: "RELATION_DELETE_FAILED" };

    const response = await patchMedia({
      action: "update",
      title: "运动会接力",
      description: "最后一棒冲过终点。",
      location: "操场",
      visibility: "class",
      downloadAllowed: false,
      tags: [],
      peopleIds: [],
    });

    expect(response.status).toBe(500);
    expect(mocks.updatePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.updatePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ review_status: "hidden" }),
    );
    expect(mocks.updatePhoto.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteRelation.mock.invocationCallOrder[0],
    );
    expect(mocks.insertRelation).not.toHaveBeenCalled();
  });

  it("deletes owner media with database keys after marking it deleted", async () => {
    mocks.updatedMedia = {
      ...mocks.selectedMedia!,
      review_status: "deleted",
    };

    const response = await deleteMedia({
      originalKey: "originals/attacker/supplied.jpg",
      previewKey: "previews/attacker/supplied.webp",
      thumbnailKey: "thumbnails/attacker/supplied.webp",
    });

    expect(response.status).toBe(200);
    expect(mocks.updatePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: "deleted",
        deleted_at: expect.any(String),
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith("id", MEDIA_ID);
    expect(mocks.updateEq).toHaveBeenCalledWith("uploaded_by", OWNER_ID);
    expect(mocks.deleteObjects).toHaveBeenCalledWith([
      mocks.selectedMedia!.original_key,
      mocks.selectedMedia!.preview_key,
      mocks.selectedMedia!.thumbnail_key,
    ]);
    expect(mocks.updatePhoto.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObjects.mock.invocationCallOrder[0],
    );
  });

  it("returns 404 without deleting storage for another member's media", async () => {
    mocks.selectedMedia = {
      ...mocks.selectedMedia!,
      uploaded_by: OTHER_ID,
    };
    mocks.updatedMedia = null;

    const response = await deleteMedia();

    expect(response.status).toBe(404);
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    if (mocks.updatePhoto.mock.calls.length > 0) {
      expect(mocks.updateEq).toHaveBeenCalledWith("id", MEDIA_ID);
      expect(mocks.updateEq).toHaveBeenCalledWith("uploaded_by", OWNER_ID);
    }
  });
});
