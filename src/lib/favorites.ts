function storageKey(scope: string): string {
  return `juvio.favorites.v1.${scope}`;
}

export function loadFavorites(scope: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveFavorites(scope: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(ids));
  } catch {
    // Favorites are best-effort local state.
  }
}
