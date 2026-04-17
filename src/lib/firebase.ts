import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

/**
 * Web client config — same fields as Flutter `DefaultFirebaseOptions` / `firebase_options.dart`.
 * Do not put a service-account JSON in the frontend; use those only on a trusted server (Admin SDK).
 */
function readFirebaseWebConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() ?? "",
  };
}

export function isFirebaseConfigured(): boolean {
  const c = readFirebaseWebConfig();
  return Boolean(c.apiKey && c.projectId && c.appId);
}

let appInstance: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (appInstance) return appInstance;
  const c = readFirebaseWebConfig();
  const options = {
    ...c,
    authDomain:
      c.authDomain ||
      (c.projectId ? `${c.projectId}.firebaseapp.com` : ""),
  };
  appInstance = getApps().length ? getApp() : initializeApp(options);
  return appInstance;
}

let analyticsPromise: Promise<Analytics | null> | null = null;

/** Resolves to Analytics in browsers that support it, when `measurementId` is set. */
export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;
  analyticsPromise = (async () => {
    const app = getFirebaseApp();
    const c = readFirebaseWebConfig();
    if (!app || !c.measurementId) return null;
    const analyticsSupported = await isSupported();
    if (!analyticsSupported) return null;
    return getAnalytics(app);
  })();
  return analyticsPromise;
}
