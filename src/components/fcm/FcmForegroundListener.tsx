import { useEffect, useRef } from "react";
import type { MessagePayload } from "firebase/messaging";
import { useNavigate } from "react-router-dom";
import { getFirebaseApp } from "@/lib/firebase";
import { resolveSupportTicketPathFromFcmPayload } from "@/lib/fcmSupportTicketNavigation";

function devFcmNavLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.log("[FCM]", ...args);
}

/** Logs every foreground push so DevTools shows full payload (messageId, notification, data). */
function logFcmForegroundMessage(payload: MessagePayload): void {
  console.info("[FCM] foreground message received", {
    messageId: payload.messageId,
    from: payload.from,
    collapseKey: payload.collapseKey,
    notification: payload.notification,
    data: payload.data,
  });
}

/**
 * Foreground FCM: navigate to {@link ROUTES.servicesSupportTicketChat} when `data` resolves to a ticket path.
 * Also handles SW {@link notificationclick} → postMessage `{ type: 'FCM_NAVIGATE', path }`.
 */
export function FcmForegroundListener(): null {
  const navigate = useNavigate();
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onSwMessage = (event: MessageEvent) => {
      const d = event.data as { type?: string; path?: string } | undefined;
      if (d?.type !== "FCM_NAVIGATE" || typeof d.path !== "string") return;
      console.info("[FCM] notification click / SW navigate", { path: d.path });
      navigate(d.path);
    };

    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    let cancelled = false;

    void (async () => {
      const app = getFirebaseApp();
      if (!app || cancelled) return;

      let messagingMod: typeof import("firebase/messaging");
      try {
        messagingMod = await import("firebase/messaging");
      } catch {
        devFcmNavLog("firebase/messaging not loaded");
        return;
      }

      if (!(await messagingMod.isSupported()) || cancelled) return;
      if (cancelled) return;

      try {
        const { getMessaging, onMessage } = messagingMod;
        const messaging = getMessaging(app);
        if (cancelled) return;
        console.info("[FCM] foreground onMessage listener registered");
        unsubRef.current = onMessage(messaging, (payload) => {
          logFcmForegroundMessage(payload);

          const path = resolveSupportTicketPathFromFcmPayload(payload);
          if (path) {
            console.info("[FCM] navigating to resolved ticket path", { path });
            navigate(path);
          } else {
            console.info("[FCM] no support-ticket path in payload; skipping navigation");
          }
        });
      } catch (e) {
        devFcmNavLog("onMessage setup failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [navigate]);

  return null;
}
