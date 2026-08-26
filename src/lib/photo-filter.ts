import type { Photo } from "@/types/domain";

export function filterPhotos(photos: Photo[], query: string, tag: string): Photo[] {
  const normalized = query.trim().toLowerCase();
  return photos.filter((photo) => {
    const tagMatches = tag === "全部" || photo.tags.includes(tag);
    const haystack = [photo.title, photo.description, photo.location, ...photo.tags, ...photo.people.map((person) => person.name)].join(" ").toLowerCase();
    return tagMatches && (!normalized || haystack.includes(normalized));
  });
}
