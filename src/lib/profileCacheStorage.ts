/** Raw JSON from `GET /patient/profile` — cleared with {@link clearClientStorageOnUnauthorized}. */
export const PROFILE_BODY_STORAGE_KEY = "opd-mobile-view.profile.body.v1";

export function saveCachedProfileRaw(body: unknown): void {
  try {
    const text = JSON.stringify(body);
    localStorage.setItem(PROFILE_BODY_STORAGE_KEY, text);
  } catch {
    /* quota / private mode */
  }
}

export function loadCachedProfileRaw(): unknown | null {
  try {
    const text = localStorage.getItem(PROFILE_BODY_STORAGE_KEY);
    if (!text?.trim()) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function clearCachedProfileRaw(): void {
  try {
    localStorage.removeItem(PROFILE_BODY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
