export function toggleFavoriteIds(ids: string[], photoId: string): string[] {
  return ids.includes(photoId) ? ids.filter((id) => id !== photoId) : [...ids, photoId];
}
