import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/app/App";
import logoSmUrl from "@/assets/images/logos/logo-sm.png";
import "./index.css";

const firebaseEnvReady = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY?.trim() &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() &&
    import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
);
if (firebaseEnvReady) {
  void import("@/lib/firebase").then(({ getFirebaseApp, getFirebaseAnalytics }) => {
    getFirebaseApp();
    void getFirebaseAnalytics();
    void import("@/lib/fcmToken").then((m) => m.prefetchWebFcmTokenSilent());
  });
}

function applyAppIcons(iconUrl: string) {
  const ensureLink = (rel: string, type: string) => {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.type = type;
    el.href = iconUrl;
    return el;
  };

  ensureLink("icon", "image/png");
  ensureLink("apple-touch-icon", "image/png");
}

applyAppIcons(logoSmUrl);

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
