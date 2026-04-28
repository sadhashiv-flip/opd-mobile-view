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
  /** Event window for schedule card (API `event_start_timestamp` / `event_end_timestamp`). */
  eventStartMs: number | null;
  eventEndMs: number | null;
}>;

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function asBoolean(v: unknown): boolean {
  return v === true;
}

/**
 * Backend may send ISO strings, epoch milliseconds, or epoch seconds (number / numeric string).
 * Exported for session-cache coercion.
 */
export function parseNoticeTimestampMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const x = v;
    // ms timestamps from ~Mar 1973 upward are >= 1e11; unix seconds today ~1.7e9
    if (x >= 1e11) return Math.round(x);
    if (x >= 1e8 && x < 1e11) return Math.round(x * 1000);
    return null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    if (/^-?\d+(\.\d+)?$/.test(t)) return parseNoticeTimestampMs(Number(t));
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** First matching key wins (Flutter uses `event_start_timestamp` / `event_end_timestamp`). */
function readEventEdgeMs(
  raw: NoticeBannerRaw,
  edge: "start" | "end",
): number | null {
  const keys =
    edge === "start"
      ? ([
          "event_start_timestamp",
          "event_start",
          "eventStart",
          "start_date",
          "startDate",
          "event_start_time",
          "start_time",
          "startTime",
        ] as const)
      : ([
          "event_end_timestamp",
          "event_end",
          "eventEnd",
          "end_date",
          "endDate",
          "event_end_time",
          "end_time",
          "endTime",
        ] as const);
  const o = raw as Record<string, unknown>;
  for (const k of keys) {
    const ms = parseNoticeTimestampMs(o[k]);
    if (ms != null) return ms;
  }
  return null;
}

/**
 * API may nest the payload (`banner`, `data`, `payload`) — matches common wrappers.
 * Outer keys win on conflict.
 */
export function normalizeNoticeBannerRow(raw: NoticeBannerRaw): NoticeBannerRaw {
  const o = raw as Record<string, unknown>;
  const nest = o.banner ?? o.data ?? o.payload ?? o.notice;
  if (nest != null && typeof nest === "object" && !Array.isArray(nest)) {
    return { ...(nest as Record<string, unknown>), ...o } as NoticeBannerRaw;
  }
  return raw;
}

function noticeTypeLower(item: NoticeBannerRaw): string {
  return (asNonEmptyString(item.type) ?? "notice").toLowerCase();
}

function asBlockLogin(row: NoticeBannerRaw): boolean {
  const o = row as Record<string, unknown>;
  return o.blockLogin === true || o.block_login === true;
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
  const row = normalizeNoticeBannerRow(item);
  if (!asBoolean(row.status)) return false;
  /** Flutter `NoticeBanner.fromJson`: `type: json['type'] ?? 'notice'` */
  if (noticeTypeLower(row) !== "notice") return false;
  const start = readEventEdgeMs(row, "start");
  const end = readEventEdgeMs(row, "end");
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
    if (isNoticeActiveAt(item, nowMs)) return normalizeNoticeBannerRow(item);
  }
  return null;
}

export function rawNoticeToDisplay(
  raw: NoticeBannerRaw,
  resolveImage: (path: string | null) => string | null,
): ActivePreLoginNotice {
  const row = normalizeNoticeBannerRow(raw);
  const imagePath = asNonEmptyString(row.image);
  const note = asNonEmptyString(row.note) ?? "";
  return {
    imageUrl: resolveImage(imagePath),
    title: asNonEmptyString(row.title),
    note,
    blockLogin: asBlockLogin(row),
    eventStartMs: readEventEdgeMs(row, "start"),
    eventEndMs: readEventEdgeMs(row, "end"),
  };
}
