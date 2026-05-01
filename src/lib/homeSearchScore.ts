import type { HomeSearchAction } from "@/constants/homeSearchIndex";

/** Mirrors Flutter `AppSearchController._score` weighting. */
export function scoreHomeSearchQuery(q: string, action: HomeSearchAction): number {
  const query = q.trim().toLowerCase();
  if (!query) return 0;

  let best = 0;

  for (const kw of action.keywords) {
    const kwLower = kw.toLowerCase();
    if (kwLower === query) return 1.0;
    if (kwLower.startsWith(query)) best = Math.max(best, 0.85);
    if (kwLower.includes(query)) best = Math.max(best, 0.6);
  }

  const titleLower = action.title.toLowerCase();
  if (titleLower === query) best = Math.max(best, 0.95);
  if (titleLower.startsWith(query)) best = Math.max(best, 0.8);
  if (titleLower.includes(query)) best = Math.max(best, 0.55);

  const subtitleLower = action.subtitle.toLowerCase();
  if (subtitleLower.includes(query)) best = Math.max(best, 0.3);

  return best;
}

export type ScoredHomeSearchAction = { action: HomeSearchAction; score: number };

export function rankHomeSearchActions(
  query: string,
  actions: readonly HomeSearchAction[],
  max = 8,
): ScoredHomeSearchAction[] {
  const q = query.trim();
  if (!q) return [];

  const scored: ScoredHomeSearchAction[] = [];
  for (const action of actions) {
    const s = scoreHomeSearchQuery(q, action);
    if (s > 0) {
      scored.push({ action, score: s });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max);
}
