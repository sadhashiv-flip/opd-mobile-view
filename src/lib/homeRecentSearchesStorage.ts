const KEY = "opd-mobile-view.home-recent-searches";
const MAX = 8;

export function loadHomeRecentSearches(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveHomeRecentSearches(next: string[]) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function addHomeRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  const cur = loadHomeRecentSearches();
  const without = cur.filter((s) => s.toLowerCase() !== q.toLowerCase());
  without.unshift(q);
  saveHomeRecentSearches(without);
}
