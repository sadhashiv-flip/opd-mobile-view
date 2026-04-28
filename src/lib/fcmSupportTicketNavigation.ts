/**
 * Resolve in-app path for Help / support ticket chat from FCM `data` (all values are strings).
 * Mirrors Flutter {@link NotificationPayload} patterns: optional JSON `details`, `ticket_id` / `ticketId`.
 */

function mergeFcmDataWithDetails(data: Record<string, string>): Record<string, string> {
  const merged = { ...data };
  const detailsRaw = merged.details;
  if (!detailsRaw || typeof detailsRaw !== "string") return merged;

  try {
    const parsed = JSON.parse(detailsRaw) as unknown;
    if (!parsed || typeof parsed !== "object") return merged;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v == null || merged[k] !== undefined) continue;
      if (typeof v === "string") merged[k] = v;
      else if (typeof v === "number" || typeof v === "boolean") merged[k] = String(v);
    }
  } catch {
    /* ignore invalid JSON */
  }
  return merged;
}

export function resolveSupportTicketPathFromFcmData(
  data: Record<string, string> | undefined,
): string | null {
  if (!data || typeof data !== "object") return null;

  const merged = mergeFcmDataWithDetails({ ...data });

  const fromPathKeys = merged.path?.trim() || merged.link?.trim() || merged.url?.trim();
  const normalized = normalizeToSupportTicketPath(fromPathKeys);
  if (normalized) return normalized;

  const typeLower = merged.type?.toLowerCase() ?? "";
  const scopedId =
    typeLower.includes("support") ||
    typeLower.includes("ticket") ||
    typeLower.includes("help")
      ? merged.id?.trim()
      : "";

  const ticketId =
    merged.ticket_id?.trim() || merged.ticketId?.trim() || scopedId;

  if (ticketId && /^[\w.-]+$/.test(ticketId)) {
    return `/services/support/ticket/${encodeURIComponent(ticketId)}`;
  }

  return null;
}

/** Same as {@link resolveSupportTicketPathFromFcmData} using full Firebase web payload shape. */
export function resolveSupportTicketPathFromFcmPayload(payload: {
  data?: Record<string, string>;
}): string | null {
  return resolveSupportTicketPathFromFcmData(payload.data);
}

function normalizeToSupportTicketPath(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;

  const prefix = "/services/support/ticket/";
  try {
    if (v.startsWith(prefix)) {
      return v.split("?")[0]?.split("#")[0] ?? null;
    }
    const base =
      globalThis.location === undefined ? "https://app.invalid" : globalThis.location.origin;
    const u = new URL(v, base);
    if (u.pathname.startsWith(prefix)) return u.pathname;
  } catch {
    return null;
  }
  return null;
}
