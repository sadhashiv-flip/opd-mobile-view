import type { ActivePreLoginNotice } from "@/lib/noticeBoard";

/** Session flag: `"false"` until a successful fetch; then `"true"` to skip refetch. */
export const PRELOGIN_NOTICE_BOARD_FETCHED_KEY = "opd-mobile-view.noticeBoard.fetched";

export const PRELOGIN_NOTICE_BOARD_FETCHED_FALSE = "false";
export const PRELOGIN_NOTICE_BOARD_FETCHED_TRUE = "true";

/** Cached result of {@link fetchActivePreLoginNotice}: active notice or none. */
export const PRELOGIN_NOTICE_BOARD_NOTICE_KEY = "opd-mobile-view.noticeBoard.activeNotice";

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
 * If session flag is `"true"`, returns cached notice (or null if none was active).
 * If flag is `"false"`, absent, or cache is corrupt, returns `shouldFetch: true`.
 * Absent flag is written as {@link PRELOGIN_NOTICE_BOARD_FETCHED_FALSE} before returning.
 */
export function readPreLoginNoticeBoardSession():
  | Readonly<{ shouldFetch: false; notice: ActivePreLoginNotice | null }>
  | Readonly<{ shouldFetch: true }> {
  try {
    const rawFlag = sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_FETCHED_KEY);
    if (rawFlag == null) {
      sessionStorage.setItem(
        PRELOGIN_NOTICE_BOARD_FETCHED_KEY,
        PRELOGIN_NOTICE_BOARD_FETCHED_FALSE,
      );
      return { shouldFetch: true };
    }
    if (rawFlag !== PRELOGIN_NOTICE_BOARD_FETCHED_TRUE) {
      return { shouldFetch: true };
    }
    const parsed = parseCachedNotice(sessionStorage.getItem(PRELOGIN_NOTICE_BOARD_NOTICE_KEY));
    if (parsed === "invalid") {
      sessionStorage.setItem(
        PRELOGIN_NOTICE_BOARD_FETCHED_KEY,
        PRELOGIN_NOTICE_BOARD_FETCHED_FALSE,
      );
      sessionStorage.removeItem(PRELOGIN_NOTICE_BOARD_NOTICE_KEY);
      return { shouldFetch: true };
    }
    return { shouldFetch: false, notice: parsed };
  } catch {
    return { shouldFetch: true };
  }
}

/** Mark notice-board as fetched this session and store the resolved notice (or null). */
export function writePreLoginNoticeBoardSession(notice: ActivePreLoginNotice | null): void {
  try {
    sessionStorage.setItem(PRELOGIN_NOTICE_BOARD_FETCHED_KEY, PRELOGIN_NOTICE_BOARD_FETCHED_TRUE);
    sessionStorage.setItem(PRELOGIN_NOTICE_BOARD_NOTICE_KEY, JSON.stringify(notice));
  } catch {
    /* ignore quota / private mode */
  }
}
