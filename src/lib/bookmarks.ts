const KEY = "kor-welfare-hub:bookmarks:v1";

export function getBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function isBookmarked(id: string): boolean {
  return getBookmarks().has(id);
}

export function toggleBookmark(id: string): boolean {
  const bm = getBookmarks();
  if (bm.has(id)) bm.delete(id);
  else bm.add(id);
  window.localStorage.setItem(KEY, JSON.stringify([...bm]));
  window.dispatchEvent(new CustomEvent("bookmarks:change"));
  return bm.has(id);
}

export function clearBookmarks() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("bookmarks:change"));
}
