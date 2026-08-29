import type { Photo, Profile } from "@/types/domain";

export function canAccessMemberArea(user: Profile | null): user is Profile {
  return Boolean(user && user.status === "approved");
}

export function canManageSite(user: Profile | null): boolean {
  return Boolean(user && user.status === "approved" && user.role === "admin");
}

export function canViewPhoto(user: Profile | null, photo: Photo): boolean {
  if (!canAccessMemberArea(user) || photo.reviewStatus !== "published") return false;
  if (user.role === "admin" || photo.uploadedBy === user.id) return true;
  if (photo.people.some((person) => person.consentStatus !== "approved")) return false;

  switch (photo.visibility) {
    case "class":
      return true;
    case "tagged_people":
      return photo.people.some((person) => person.id === user.id && person.consentStatus === "approved");
    case "selected":
      return photo.selectedUserIds.includes(user.id);
    case "private":
      return false;
  }
}

export function canDownloadOriginal(user: Profile | null, photo: Photo): boolean {
  if (!canViewPhoto(user, photo)) return false;
  return (
    user?.role === "admin" ||
    photo.uploadedBy === user?.id ||
    photo.downloadAllowed
  );
}

export function filterVisiblePhotos(user: Profile | null, photos: Photo[]): Photo[] {
  return photos.filter((photo) => canViewPhoto(user, photo));
}
