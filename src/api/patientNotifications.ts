import { patientFetchChecked, patientJson } from "@/api/patientHttp";

export type PatientNotificationRow = Readonly<{
  id: string;
  title: string;
  body: string;
  type: string;
  details: unknown;
  createdAt: string | null;
}>;

type NotificationsApiResponse = Readonly<{
  notifications?: unknown;
}>;

function parseNotificationRow(item: unknown): PatientNotificationRow | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const body = typeof row.body === "string" ? row.body.trim() : "";
  const type = typeof row.type === "string" ? row.type.trim() : "";
  if (!id) return null;
  const createdRaw = row.createdAt ?? row.created_at;
  const createdAt =
    typeof createdRaw === "string" && createdRaw.trim() ? createdRaw.trim() : null;
  return {
    id,
    title: title || "Notification",
    body,
    type,
    details: row.details,
    createdAt,
  };
}

function normalizeNotifications(raw: unknown): PatientNotificationRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PatientNotificationRow[] = [];
  for (const item of raw) {
    const row = parseNotificationRow(item);
    if (row) out.push(row);
  }
  return out;
}

/** GET `/patient/notification` (Bearer) — list items for the notifications screen. */
export async function fetchPatientNotifications(): Promise<readonly PatientNotificationRow[]> {
  const data = await patientJson<NotificationsApiResponse>("notification", {
    method: "GET",
    skipGlobalLoading: true,
  });
  const items = normalizeNotifications(data.notifications);
  return items.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

/**
 * PATCH `/patient/notification/markasread` — best-effort (patient_app
 * {@link NotificationsRepository.markAsRead}); failures are ignored.
 */
export async function markPatientNotificationsRead(): Promise<void> {
  try {
    const res = await patientFetchChecked("notification/markasread", {
      method: "PATCH",
      body: JSON.stringify({}),
      skipGlobalLoading: true,
    });
    await res.text();
  } catch {
    /* ignore */
  }
}

/** DELETE `/patient/notification` — clear all (patient_app {@link NotificationsRepository.clearAllNotifications}). */
export async function clearAllPatientNotifications(): Promise<void> {
  const res = await patientFetchChecked("notification", {
    method: "DELETE",
    skipGlobalLoading: true,
  });
  await res.text();
}

/** DELETE `/patient/notification/:id` — remove one (patient_app {@link NotificationsRepository.deleteNotificationById}). */
export async function deletePatientNotificationById(id: string): Promise<void> {
  const res = await patientFetchChecked(`notification/${encodeURIComponent(id)}`, {
    method: "DELETE",
    skipGlobalLoading: true,
  });
  await res.text();
}
