/** Merges layout-specific classes with the global `app-back-btn` shell. */
export function backButtonClass(...parts: (string | undefined | false)[]): string {
  const tokens = new Set<string>(["app-back-btn"]);
  for (const part of parts) {
    if (!part) continue;
    for (const token of part.split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return [...tokens].join(" ");
}
