import { encryptJson, decryptJson } from "@/lib/sessionCrypto";
import type { StoredAuthSession, VerifySuccessResponse } from "@/types/authSession";

export const AUTH_SESSION_STORAGE_KEY = "opd-mobile-view.auth.session.v1";

/** Dispatched when an authenticated request returns 401 (after session cleared). */
export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

function getEncryptionSecret(): string {
  const s = import.meta.env.VITE_SESSION_SECRET;
  if (typeof s === "string" && s.length >= 16) return s;
  if (import.meta.env.DEV) {
    console.warn(
      "[auth] VITE_SESSION_SECRET missing or short; using dev-only secret. Set VITE_SESSION_SECRET (≥16 chars) for production.",
    );
    return "opd-mobile-dev-only!";
  }
  throw new Error(
    "VITE_SESSION_SECRET must be set (minimum 16 characters) for encrypted session storage.",
  );
}

let memoryCache: StoredAuthSession | null | undefined;

export function invalidateAuthSessionCache(): void {
  memoryCache = undefined;
}

export async function saveAuthSession(data: VerifySuccessResponse): Promise<void> {
  const session: StoredAuthSession = {
    user: data.user,
    token: data.token,
    isReg: data.isReg,
    link: data.link,
    message: data.message,
  };
  const secret = getEncryptionSecret();
  const payload = await encryptJson(secret, session);
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, payload);
  memoryCache = session;
}

export async function getAuthSession(): Promise<StoredAuthSession | null> {
  if (memoryCache !== undefined) {
    return memoryCache;
  }
  let raw: string | null;
  try {
    raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    memoryCache = null;
    return null;
  }
  if (!raw) {
    memoryCache = null;
    return null;
  }
  try {
    const secret = getEncryptionSecret();
    const session = await decryptJson<StoredAuthSession>(secret, raw);
    if (!session?.token || !session?.user) {
      memoryCache = null;
      return null;
    }
    memoryCache = session;
    return session;
  } catch {
    memoryCache = null;
    try {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const s = await getAuthSession();
  return s?.token ?? null;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  memoryCache = undefined;
}
