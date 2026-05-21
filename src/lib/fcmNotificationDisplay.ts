import type { MessagePayload } from "firebase/messaging";
import { FCM_NOTIFICATION_ICON_URL } from "@/constants/fcmNotificationIcon";
import { mergeFcmDataWithDetails } from "@/lib/fcmSupportTicketNavigation";
import { resolveFcmNavigatePathFromPayload } from "@/lib/fcmDeepLinkNavigation";

function fcmForegroundNotificationTag(payload: MessagePayload): string {
  if (payload.messageId) return `fcm-${payload.messageId}`;
  if (payload.collapseKey) return `fcm-${payload.collapseKey}-${Date.now()}`;
  return `fcm-fg-${Date.now()}`;
}

/** String-only values for Notification API `data`. */
function stringifyNotificationData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(data)) {
    if (n++ >= 48) break;
    out[k.slice(0, 64)] = String(v).slice(0, 1000);
  }
  return out;
}

/** Title/body for system UI: `notification` wins, else merged `data` (+ parsed `details`). */
export function getFcmNotificationTitleBody(payload: MessagePayload): { title: string; body: string } {
  const merged = mergeFcmDataWithDetails(payload.data ? { ...payload.data } : {});
  const n = payload.notification;
  const titleRaw = (n?.title ?? merged.title ?? "Notification").trim();
  const bodyRaw = (n?.body ?? merged.body ?? "").trim();
  return { title: titleRaw || "Notification", body: bodyRaw };
}

/**
 * Foreground FCM: show a browser notification when permission is granted.
 * Uses the FCM service worker so {@link notificationclick} in `firebase-messaging-sw.js` still applies.
 */
export async function showWebPushFromFcmPayload(payload: MessagePayload): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const { title, body } = getFcmNotificationTitleBody(payload);
  const path = resolveFcmNavigatePathFromPayload(payload);
  const dataRaw: Record<string, string> = payload.data ? { ...payload.data } : {};
  if (path) dataRaw.path = path;
  const data = stringifyNotificationData(dataRaw);

  const icon =
    payload.notification?.icon?.trim() ||
    payload.notification?.image?.trim() ||
    FCM_NOTIFICATION_ICON_URL;

  const tag = fcmForegroundNotificationTag(payload);

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "showNotification" in reg) {
      await reg.showNotification(title, { body, icon, data, tag });
    } else {
      new Notification(title, { body, icon });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[FCM] showWebPushFromFcmPayload failed", e);
  }
}
