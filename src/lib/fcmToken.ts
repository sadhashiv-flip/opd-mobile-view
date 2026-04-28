import { getFirebaseApp } from "@/lib/firebase";

function devFcmLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.log("[FCM]", ...args);
}

const FCM_SW_PATH = "/firebase-messaging-sw.js";
/** Same prefix as other app keys so {@link clearClientStorageOnUnauthorized} removes it. */
const FCM_REGISTRATION_TOKEN_KEY = "opd-mobile-view.fcm.registrationToken.v1";

let inFlight: Promise<string> | null = null;

function readPersistedFcmToken(): string {
  if (!globalThis.window) return "";
  try {
    const v = globalThis.localStorage.getItem(FCM_REGISTRATION_TOKEN_KEY)?.trim();
    return v && v.length > 0 ? v : "";
  } catch {
    return "";
  }
}

function writePersistedFcmToken(token: string): void {
  if (!globalThis.window) return;
  try {
    if (token.length > 0) {
      globalThis.localStorage.setItem(FCM_REGISTRATION_TOKEN_KEY, token);
    } else {
      globalThis.localStorage.removeItem(FCM_REGISTRATION_TOKEN_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(FCM_SW_PATH, {
      type: "classic",
      scope: "/",
    });
  } catch (e) {
    devFcmLog(`registerFcmServiceWorker: failed to register ${FCM_SW_PATH}`, e);
    return null;
  }
}

async function fetchFreshWebFcmToken(): Promise<string> {
  if (!globalThis.window) return "";

  let messagingMod: typeof import("firebase/messaging");
  try {
    messagingMod = await import("firebase/messaging");
  } catch (e) {
    devFcmLog("fetchFreshWebFcmToken: failed to load firebase/messaging", e);
    return "";
  }

  const app = getFirebaseApp();
  if (!app) return "";

  try {
    /** Avoid `getMessaging` on unsupported browsers — it throws `messaging/unsupported-browser` and can throw `addEventListener` on undefined internally. */
    if (!(await messagingMod.isSupported())) {
      devFcmLog(
        "fetchFreshWebFcmToken: Firebase messaging not supported (use Chrome/Edge/Firefox on https:// or http://localhost)",
      );
      return "";
    }

    const { getMessaging, getToken } = messagingMod;
    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() ?? "";
    const registration = await registerFcmServiceWorker();
    const token = await getToken(messaging, {
      vapidKey,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });
    return typeof token === "string" && token.length > 0 ? token : "";
  } catch (e) {
    devFcmLog("fetchFreshWebFcmToken: getToken error", e);
    return "";
  }
}

/**
 * Web FCM registration token for the patient API (`fcm_token` on POST /register, /verify, etc.).
 * Reads from {@link FCM_REGISTRATION_TOKEN_KEY} first; only calls Firebase when nothing is stored yet.
 */
export async function getWebFcmToken(): Promise<string> {
  if (!globalThis.window) return "";

  const stored = readPersistedFcmToken();
  if (stored) return stored;

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const fresh = await fetchFreshWebFcmToken();
    if (fresh) writePersistedFcmToken(fresh);
    return fresh;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Clears persisted + in-flight FCM token (e.g. after invalid token or full reset). */
export function clearWebFcmTokenCache(): void {
  inFlight = null;
  writePersistedFcmToken("");
}

/** Starts an FCM token fetch in the background for later register/verify payloads. */
export function prefetchWebFcmTokenSilent(): void {
  void getWebFcmToken();
}
