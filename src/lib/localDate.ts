/** Local calendar date as `yyyy-MM-dd` (for `<input type="date">` min/max). */
export function localYyyyMmDd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Keeps `yyyy-MM-dd` on or before `maxIso` (both local calendar dates). */
export function clampLocalDateToMax(iso: string, maxIso: string): string {
  const v = iso.trim();
  if (!v) return v;
  return v > maxIso ? maxIso : v;
}
