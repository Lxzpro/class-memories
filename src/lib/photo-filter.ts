import type { Photo } from "@/types/domain";

export const ALL_UPLOADERS = "all";
export const MY_UPLOADS = "mine";
export const CLASS_ARCHIVE_UPLOADER_ID = "class-archive";

export type UploaderFilterValue =
  | typeof ALL_UPLOADERS
  | typeof MY_UPLOADS
  | `uploader:${string}`;

export type UploaderSummary = {
  id: string;
  filterValue: `uploader:${string}`;
  name: string;
  count: number;
  latestAt: string;
  isClassArchive: boolean;
};

function uploaderId(photo: Photo) {
  return photo.uploaderRole === "admin"
    ? CLASS_ARCHIVE_UPLOADER_ID
    : photo.uploadedBy;
}

export function uploaderFilterValue(photo: Photo): `uploader:${string}` {
  return `uploader:${uploaderId(photo)}`;
}

export function summarizeUploaders(photos: Photo[]): UploaderSummary[] {
  const uploaders = new Map<string, UploaderSummary>();

  for (const photo of photos) {
    const id = uploaderId(photo);
    const existing = uploaders.get(id);
    if (existing) {
      existing.count += 1;
      if (photo.createdAt > existing.latestAt) existing.latestAt = photo.createdAt;
      continue;
    }

    const isClassArchive = id === CLASS_ARCHIVE_UPLOADER_ID;
    uploaders.set(id, {
      id,
      filterValue: `uploader:${id}`,
      name: isClassArchive ? "班级资料" : photo.uploaderName,
      count: 1,
      latestAt: photo.createdAt,
      isClassArchive,
    });
  }

  return Array.from(uploaders.values()).sort(
    (first, second) =>
      second.count - first.count ||
      second.latestAt.localeCompare(first.latestAt) ||
      first.name.localeCompare(second.name, "zh-CN"),
  );
}

export function filterPhotos(
  photos: Photo[],
  query: string,
  uploader: UploaderFilterValue,
  viewerId?: string,
): Photo[] {
  const normalized = query.trim().toLowerCase();
  return photos.filter((photo) => {
    const uploaderMatches =
      uploader === ALL_UPLOADERS ||
      (uploader === MY_UPLOADS && Boolean(viewerId) && photo.uploadedBy === viewerId) ||
      (uploader.startsWith("uploader:") &&
        uploader === uploaderFilterValue(photo));
    const haystack = [
      photo.title,
      photo.description,
      photo.location,
      photo.uploaderName,
      ...photo.tags,
      ...photo.people.map((person) => person.name),
    ]
      .join(" ")
      .toLowerCase();
    return uploaderMatches && (!normalized || haystack.includes(normalized));
  });
}
