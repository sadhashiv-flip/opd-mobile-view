/**
 * Pure helpers: normalize `banners` payload and pick the first active pre-login notice.
 */

export type NoticeBannerRaw = Readonly<{
  status?: unknown;
  type?: unknown;
  event_start_timestamp?: unknown;
  event_end_timestamp?: unknown;
  image?: unknown;
  note?: unknown;
  title?: unknown;
  blockLogin?: unknown;
}>;

export type ActivePreLoginNotice = Readonly<{
  imageUrl: string | null;
  title: string | null;
  note: string;
  blockLogin: boolean;
}>;

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function asBoolean(v: unknown): boolean {
  return v === true;
}

function parseInstantMs(v: unknown): number | null {
  const s = asNonEmptyString(v);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/** API may return `null`, one object, or an array. */
export function bannersToItems(banners: unknown): NoticeBannerRaw[] {
  if (banners == null) return [];
  if (Array.isArray(banners)) return banners as NoticeBannerRaw[];
  if (typeof banners === "object") return [banners as NoticeBannerRaw];
  return [];
}

export function isNoticeActiveAt(
  item: NoticeBannerRaw,
  nowMs: number,
): boolean {
  if (!asBoolean(item.status)) return false;
  if (asNonEmptyString(item.type)?.toLowerCase() !== "notice") return false;
  const start = parseInstantMs(item.event_start_timestamp);
  const end = parseInstantMs(item.event_end_timestamp);
  if (start == null || end == null) return false;
  return nowMs >= start && nowMs <= end;
}

/**
 * First banner that satisfies status, type, and time window (in array order).
 */
export function pickFirstActiveNotice(
  items: readonly NoticeBannerRaw[],
  nowMs: number,
): NoticeBannerRaw | null {
  for (const item of items) {
    if (isNoticeActiveAt(item, nowMs)) return item;
  }
  return null;
}

export function rawNoticeToDisplay(
  raw: NoticeBannerRaw,
  resolveImage: (path: string | null) => string | null,
): ActivePreLoginNotice {
  const imagePath = asNonEmptyString(raw.image);
  const note = asNonEmptyString(raw.note) ?? "";
  return {
    imageUrl: resolveImage(imagePath),
    title: asNonEmptyString(raw.title),
    note,
    blockLogin: asBoolean(raw.blockLogin),
  };
}
