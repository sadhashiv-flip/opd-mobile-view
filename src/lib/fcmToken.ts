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
  if (!globalThis.window) {
    devFcmLog("fetchFreshWebFcmToken: no window");
    return "";
  }
  /** Web Push / FCM `getToken` requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): `https://`, or `http://localhost` / `127.0.0.1` — not `http://192.168…`. */
  if (globalThis.isSecureContext === false) {
    devFcmLog(
      "fetchFreshWebFcmToken: insecure origin — browsers only expose Web Push/FCM on secure contexts: https://, or http://localhost (not http://192.168…). Fix: open http://localhost:3000, or remove VITE_DEV_SERVER_HTTPS=false from .env and open https://<your-ip>:3000 (trust the dev cert).",
    );
    return "";
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    devFcmLog(
      "fetchFreshWebFcmToken: empty token — set VITE_FIREBASE_VAPID_KEY in .env (Firebase Console → Cloud Messaging → Web Push certificates)",
    );
    return "";
  }

  let messagingMod: typeof import("firebase/messaging");
  try {
    messagingMod = await import("firebase/messaging");
    if (!(await messagingMod.isSupported())) {
      devFcmLog("fetchFreshWebFcmToken: Firebase messaging not supported in this browser");
      return "";
    }
  } catch (e) {
    devFcmLog("fetchFreshWebFcmToken: failed to load firebase/messaging", e);
    return "";
  }

  const app = getFirebaseApp();
  if (!app) {
    devFcmLog(
      "fetchFreshWebFcmToken: Firebase web app not configured — check VITE_FIREBASE_* env vars",
    );
    return "";
  }

  try {
    const { getMessaging, getToken } = messagingMod;
    const messaging = getMessaging(app);
    if (!("Notification" in globalThis)) {
      devFcmLog("fetchFreshWebFcmToken: Notifications API unavailable");
      return "";
    }
    const current = Notification.permission;
    if (current === "denied") {
      devFcmLog("fetchFreshWebFcmToken: notification permission denied — enable site notifications and retry");
      return "";
    }
    const permission = current === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      devFcmLog("fetchFreshWebFcmToken: notification permission not granted:", permission);
      return "";
    }

    const registration = await registerFcmServiceWorker();
    if (!registration) {
      devFcmLog(
        `fetchFreshWebFcmToken: service worker registration failed for ${FCM_SW_PATH} — check Network tab and that the file is served at origin root`,
      );
    }
    const token = await getToken(messaging, {
      vapidKey,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });
    const ok = typeof token === "string" && token.length > 0 ? token : "";
    if (!ok) {
      devFcmLog("fetchFreshWebFcmToken: getToken returned empty — check VAPID key pair matches this Firebase project");
    }
    return ok;
  } catch (e) {
    devFcmLog("fetchFreshWebFcmToken: getToken error", e);
    return "";
  }
}

/**
 * Web FCM registration token for the patient API (`fcm_token` on POST /register, /verify, etc.).
 * Reads from {@link FCM_REGISTRATION_TOKEN_KEY} first; only calls Firebase when nothing is stored yet.
 * Returns empty string when messaging is unsupported, env is incomplete, permission denied, or on error.
 */
export async function getWebFcmToken(): Promise<string> {
  if (!globalThis.window) {
    devFcmLog("getWebFcmToken: no window");
    return "";
  }

  const stored = readPersistedFcmToken();
  if (stored) {
    devFcmLog("getWebFcmToken (persisted registration token):", stored);
    return stored;
  }

  if (inFlight) {
    const token = await inFlight;
    devFcmLog("getWebFcmToken (shared in-flight registration token):", token || "(empty)");
    return token;
  }

  inFlight = (async () => {
    const fresh = await fetchFreshWebFcmToken();
    if (fresh) writePersistedFcmToken(fresh);
    return fresh;
  })();
  try {
    const token = await inFlight;
    devFcmLog("getWebFcmToken (after fresh fetch):", token || "(empty — POST /patient/register will send fcm_token as \"\")");
    return token;
  } finally {
    inFlight = null;
  }
}

/** Clears persisted + in-flight FCM token (e.g. after invalid token or full reset). */
export function clearWebFcmTokenCache(): void {
  inFlight = null;
  writePersistedFcmToken("");
}

/**
 * If notification permission is already granted, obtain a token in the background (no prompt)
 * and persist it for later register/verify.
 */
export function prefetchWebFcmTokenSilent(): void {
  void (async () => {
    if (!import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()) return;
    if (!("Notification" in globalThis) || Notification.permission !== "granted") return;
    await getWebFcmToken();
  })();
}
