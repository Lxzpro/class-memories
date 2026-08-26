export function chooseRandomId(ids: string[], recentIds: string[], random = Math.random): string | null {
  if (ids.length === 0) return null;
  const recent = new Set(recentIds);
  const candidates = ids.filter((id) => !recent.has(id));
  const pool = candidates.length > 0 ? candidates : ids;
  return pool[Math.floor(random() * pool.length)] ?? pool[0] ?? null;
}

export function pushRecentId(recentIds: string[], id: string, limit = 10): string[] {
  return [id, ...recentIds.filter((item) => item !== id)].slice(0, limit);
}
