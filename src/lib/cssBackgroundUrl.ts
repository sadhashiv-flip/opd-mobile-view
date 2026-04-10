/**
 * Builds a safe `background-image` value for inline `style={{ ... }}`.
 * Unquoted `url(data:image/svg+xml,...)` breaks when the SVG contains `#` (hex colors):
 * CSS treats `#` as the start of a URL fragment. Quoting fixes that; this also escapes `"` and `\`.
 */
export function cssBackgroundUrl(resolvedUrl: string): string {
  const escaped = resolvedUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}
