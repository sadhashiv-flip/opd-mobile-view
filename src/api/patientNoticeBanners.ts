import { patientJsonRoot } from "@/api/patientHttp";
import {
  bannersToItems,
  pickFirstActiveNotice,
  rawNoticeToDisplay,
  type ActivePreLoginNotice,
} from "@/lib/noticeBoard";
import { resolveProfileImageUrl } from "@/api/patientProfile";

/**
 * GET `/notice-board` on the API host root (see `getPatientApiRootBase` in patientClient — not under `/patient`).
 * Response shape: `{ banners: null | object | array }`.
 */
const NOTICE_BANNERS_PATH = "notice-board";

export type NoticeBannersApiResponse = Readonly<{
  banners?: unknown;
}>;

function resolveNoticeImage(path: string | null): string | null {
  return resolveProfileImageUrl(path);
}

function isAbortError(e: unknown): boolean {
  return (
    e instanceof DOMException && e.name === "AbortError"
  ) || (e instanceof Error && e.name === "AbortError");
}

/**
 * Fetches notice banners and returns the first active pre-login notice, or `null`.
 * On other errors, returns `null` (fail-open to login). Re-throws abort so callers can ignore stale updates.
 */
export async function fetchActivePreLoginNotice(
  now: Date = new Date(),
  init?: Readonly<{ signal?: AbortSignal }>,
): Promise<ActivePreLoginNotice | null> {
  try {
    const data = await patientJsonRoot<NoticeBannersApiResponse>(NOTICE_BANNERS_PATH, {
      method: "GET",
      skipAuth: true,
      skipGlobalLoading: true,
      signal: init?.signal,
    });
    const items = bannersToItems(data.banners);
    const raw = pickFirstActiveNotice(items, now.getTime());
    if (!raw) return null;
    return rawNoticeToDisplay(raw, resolveNoticeImage);
  } catch (e) {
    if (isAbortError(e)) throw e;
    return null;
  }
}
