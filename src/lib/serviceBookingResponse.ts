/** Parsed POST `/service/{vision|vaccine|dental}/request` body — parity with patient-app booking responses. */
export type ServiceBookingResponseParsed = Readonly<{
  invoiceId: string;
  orderId: string;
  message: string;
}>;

/** `invoice_id` (or `service.id`), `service.id` as order id, optional `message`. */
export function parseServiceBookingResponse(data: unknown): ServiceBookingResponseParsed {
  if (data == null || typeof data !== "object") {
    return { invoiceId: "", orderId: "", message: "" };
  }
  const root = data as Record<string, unknown>;
  let invoiceId = String(root.invoice_id ?? "").trim();
  let message = String(root.message ?? "").trim();
  let orderId = "";

  const service = root.service;
  if (service != null && typeof service === "object") {
    const s = service as Record<string, unknown>;
    orderId = String(s.id ?? "").trim();
    if (!invoiceId) invoiceId = orderId;
  }

  const inner = root.data;
  if (inner != null && typeof inner === "object") {
    const nested = inner as Record<string, unknown>;
    if (!invoiceId) {
      invoiceId = String(nested.invoice_id ?? nested.id ?? "").trim();
    }
    if (!message) message = String(nested.message ?? "").trim();
    if (!orderId) {
      const nestedService = nested.service;
      if (nestedService != null && typeof nestedService === "object") {
        orderId = String((nestedService as Record<string, unknown>).id ?? "").trim();
      }
    }
  }

  return { invoiceId, orderId, message };
}
