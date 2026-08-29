import { describe, expect, it } from "vitest";
import { orderPhotos, parsePhotoOrder } from "@/lib/photo-order";

type OrderablePhoto = { id: string; createdAt: string; marker?: string };

const photos: OrderablePhoto[] = [
  { id: "photo-d", createdAt: "2026-03-01T08:00:00.000Z" },
  { id: "photo-a", createdAt: "2026-01-01T08:00:00.000Z" },
  { id: "photo-f", createdAt: "2026-04-01T08:00:00.000Z" },
  { id: "photo-c", createdAt: "2026-02-01T08:00:00.000Z" },
  { id: "photo-h", createdAt: "2026-06-01T08:00:00.000Z" },
  { id: "photo-b", createdAt: "2026-01-01T08:00:00.000Z" },
  { id: "photo-g", createdAt: "2026-05-01T08:00:00.000Z" },
  { id: "photo-e", createdAt: "2026-03-01T08:00:00.000Z" },
];

describe("photo ordering", () => {
  it("parses supported order values and defaults invalid input to random", () => {
    expect(parsePhotoOrder("random")).toBe("random");
    expect(parsePhotoOrder("newest")).toBe("newest");
    expect(parsePhotoOrder("oldest")).toBe("oldest");
    expect(parsePhotoOrder("popular")).toBe("random");
    expect(parsePhotoOrder(undefined)).toBe("random");
    expect(parsePhotoOrder(["newest"])).toBe("random");
  });

  it("creates a deterministic shuffle independent of the input order", () => {
    const first = orderPhotos(photos, "random", "visit-seed");
    const second = orderPhotos([...photos].reverse(), "random", "visit-seed");

    expect(second.map((photo) => photo.id)).toEqual(
      first.map((photo) => photo.id),
    );
  });

  it("produces a different arrangement for a different seed", () => {
    const first = orderPhotos(photos, "random", "visit-seed-a");
    const second = orderPhotos(photos, "random", "visit-seed-b");

    expect(second.map((photo) => photo.id)).not.toEqual(
      first.map((photo) => photo.id),
    );
  });

  it("does not mutate, lose, or duplicate input items while shuffling", () => {
    const snapshot = photos.map((photo) => ({ ...photo }));
    const shuffled = orderPhotos(photos, "random", "complete-set");

    expect(photos).toEqual(snapshot);
    expect(shuffled).not.toBe(photos);
    expect(shuffled).toHaveLength(photos.length);
    expect([...shuffled.map((photo) => photo.id)].sort()).toEqual(
      [...photos.map((photo) => photo.id)].sort(),
    );
    expect(new Set(shuffled.map((photo) => photo.id)).size).toBe(photos.length);
  });

  it("orders newest and oldest by creation time with id tie-breaking", () => {
    expect(orderPhotos(photos, "newest", "unused").map((photo) => photo.id)).toEqual([
      "photo-h",
      "photo-g",
      "photo-f",
      "photo-d",
      "photo-e",
      "photo-c",
      "photo-a",
      "photo-b",
    ]);
    expect(orderPhotos(photos, "oldest", "unused").map((photo) => photo.id)).toEqual([
      "photo-a",
      "photo-b",
      "photo-c",
      "photo-d",
      "photo-e",
      "photo-f",
      "photo-g",
      "photo-h",
    ]);
  });
});
