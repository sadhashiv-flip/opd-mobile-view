/**
 * Notifications from `GET /notification` include a `details` blob; invoice-backed
 * orders use `invoice_id` (same id as {@link ROUTES.ordersDetail}).
 */
export function invoiceIdFromNotificationDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const direct = d.invoice_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = d.details;
  if (nested && typeof nested === "object") {
    const inner = (nested as Record<string, unknown>).invoice_id;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return null;
}
