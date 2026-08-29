import type { Photo } from "@/types/domain";

export type PhotoOrder = "random" | "newest" | "oldest";

export function parsePhotoOrder(value: unknown): PhotoOrder {
  return value === "newest" || value === "oldest" || value === "random"
    ? value
    : "random";
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

export function orderPhotos<T extends Pick<Photo, "id" | "createdAt">>(
  items: T[],
  order: PhotoOrder,
  seed: string,
): T[] {
  if (order !== "random") {
    const direction = order === "newest" ? -1 : 1;
    return [...items].sort((left, right) => {
      if (left.createdAt < right.createdAt) return -1 * direction;
      if (left.createdAt > right.createdAt) return direction;
      return compareIds(left.id, right.id);
    });
  }

  const result = [...items].sort((left, right) => compareIds(left.id, right.id));
  const random = createSeededRandom(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
