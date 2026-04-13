import type { ActivePreLoginNotice } from "@/lib/noticeBoard";

/**
 * When `"true"`: notice UI must not be shown (user dismissed, or API returned no notice).
 * When `"false"`: a notice may still be shown from cache after `apiDone`.
 */
export const PRELOGIN_NOTICE_BOARD_FETCHED_KEY = "opd-mobile-view.noticeBoard.fetched";

/**
 * When `"true"`: notice-board GET has completed this tab session — do not call the API again.
 */
export const PRELOGIN_NOTICE_BOARD_API_DONE_KEY = "opd-mobile-view.noticeBoard.apiDone";

export const PRELOGIN_NOTICE_BOARD_FETCHED_FALSE = "false";
export const PRELOGIN_NOTICE_BOARD_FETCHED_TRUE = "true";

/** Cached result of {@link fetchActivePreLoginNotice}: active notice or none. */
export const PRELOGIN_NOTICE_BOARD_NOTICE_KEY = "opd-mobile-view.noticeBoard.activeNotice";

function isStorageTrueString(raw: string | null): boolean {
  if (raw == null) return false;
  return raw.trim().toLowerCase() === PRELOGIN_NOTICE_BOARD_FETCHED_TRUE;
}

/** True when {@link PRELOGIN_NOTICE_BOARD_FETCHED_KEY} means “do not show notice UI”. */
export function isPreLoginNoticeBoardFetchedFlagTrue(raw: string | null): boolean {
  return isStorageTrueString(raw);
}

function parseCachedNotice(raw: string | null): ActivePreLoginNotice | null | "invalid" {
  if (raw == null || raw === "") return "invalid";
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === null) return null;
    if (typeof v !== "object" || v === null) return "invalid";
    const o = v as Record<string, unknown>;
    if (typeof o.note !== "string" || typeof o.blockLogin !== "boolean") return "invalid";
    const imageUrl = o.imageUrl;
    const title = o.title;
    if (imageUrl != null && typeof imageUrl !== "string") return "invalid";
    if (title != null && typeof title !== "string") return "invalid";
    return {
      imageUrl: imageUrl ?? null,
      title: title ?? null,
      note: o.note,
      blockLogin: o.blockLogin,
    };
  } catch {
    return "invalid";
  }
}

/**
 * - API runs only while {@link PRELOGIN_NOTICE_BOARD_API_DONE_KEY} is not true (with legacy
 *   fallback: older builds only set `fetched` — if that is true, treat API as done).
 * - Returned `notice` is for UI only: when {@link PRELOGIN_NOTICE_BOARD_FETCHED_KEY} is true,
 *   `notice` is always `null` so {@link NoticeScreen} is not shown.
 */
export function readPreLoginNoticeBoardSession():
  | Readonly<{ shouldFetch: false; notice: ActivePreLoginNotice | null }>
  | Readonly<{ shouldFetch: true }> {
  try {
    const rawFetched = sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_FETCHED_KEY);
    const rawApiDone = sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_API_DONE_KEY);

    if (rawFetched == null) {
      sessionStorage.setItem(
        PRELOGIN_NOTICE_BOARD_FETCHED_KEY,
        PRELOGIN_NOTICE_BOARD_FETCHED_FALSE,
      );
    }

    const fetchedTrue = isStorageTrueString(sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_FETCHED_KEY));
    const apiDoneExplicit = isStorageTrueString(rawApiDone);
    /** Older sessions: only `fetched` existed and was set true after GET (with or without a notice). */
    const apiDoneLegacy = rawApiDone == null && fetchedTrue;
    const apiDone = apiDoneExplicit || apiDoneLegacy;

    if (!apiDone) {
      return { shouldFetch: true };
    }

    const noticeRaw = sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_NOTICE_KEY);
    const parsed = parseCachedNotice(noticeRaw);
    if (parsed === "invalid") {
      try {
        sessionStorage.setItem(PRELOGIN_NOTICE_BOARD_NOTICE_KEY, JSON.stringify(null));
      } catch {
        /* ignore */
      }
      return { shouldFetch: false, notice: null };
    }

    const hideNoticeUi = isStorageTrueString(sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_FETCHED_KEY));
    return { shouldFetch: false, notice: hideNoticeUi ? null : parsed };
  } catch {
    return { shouldFetch: true };
  }
}

/**
 * Persists GET result: marks API complete, stores notice JSON, and sets `fetched` to true only
 * when there is no notice (nothing to show).
 */
export function writePreLoginNoticeBoardSession(notice: ActivePreLoginNotice | null): void {
  try {
    sessionStorage.setItem(PRELOGIN_NOTICE_BOARD_API_DONE_KEY, PRELOGIN_NOTICE_BOARD_FETCHED_TRUE);
    sessionStorage.setItem(
      PRELOGIN_NOTICE_BOARD_FETCHED_KEY,
      notice == null ? PRELOGIN_NOTICE_BOARD_FETCHED_TRUE : PRELOGIN_NOTICE_BOARD_FETCHED_FALSE,
    );
    sessionStorage.setItem(PRELOGIN_NOTICE_BOARD_NOTICE_KEY, JSON.stringify(notice));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Call when the user leaves {@link NoticeScreen} (non-blocking notice) so it is not shown again. */
export function markPreLoginNoticeBoardUiComplete(): void {
  try {
    sessionStorage.setItem(PRELOGIN_NOTICE_BOARD_FETCHED_KEY, PRELOGIN_NOTICE_BOARD_FETCHED_TRUE);
  } catch {
    /* ignore */
  }
}
