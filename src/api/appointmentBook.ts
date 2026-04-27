import { patientJson } from "@/api/patientHttp";

export type BookAppointmentPayload = Readonly<{
  date: string;
  time: string;
  language: string;
  patient_id: number;
  issue_id: number;
  purpose: string;
  /** Prior appointment id for follow-up booking (optional). */
  appointment_id?: string;
}>;

/** Merge top-level JSON with nested `data` (common API envelope). */
export function readAppointmentPaymentLayer(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const o = json as Record<string, unknown>;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...o, ...(data as Record<string, unknown>) };
  }
  return o;
}

export function isAppointmentPaymentRequired(data: unknown): boolean {
  if (data == null || typeof data !== "object") return true;
  const layer = readAppointmentPaymentLayer(data);
  const pr = layer.paymentRequired ?? layer.isPaymentRequired ?? layer.payment_required;
  return !(pr === false || pr === "false" || pr === 0);
}

export function readAppointmentResponseMessage(data: unknown): string | undefined {
  const layer = readAppointmentPaymentLayer(data);
  const m = layer.message;
  return typeof m === "string" && m.trim() ? m.trim() : undefined;
}

export function readRazorpayPayloadFromAppointmentResponse(data: unknown): Record<string, unknown> | null {
  const layer = readAppointmentPaymentLayer(data);
  const raw = layer.razorpay_payload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function readInfoIdFromRecord(node: Record<string, unknown> | null): string | null {
  if (!node) return null;
  const info = node.info;
  if (!info || typeof info !== "object" || Array.isArray(info)) return null;
  const id = (info as Record<string, unknown>).id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/** Order / appointment id fields — never `invoice_id` / `invoiceId` (those are for payment/detail routes only). */
function readNonInvoiceScalarId(o: Record<string, unknown>): string | null {
  for (const k of ["id", "order_id", "orderId"] as const) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Offline (`network/book` etc.): response `appt.id`. */
function readApptNestedId(o: Record<string, unknown>): string | null {
  const appt = o.appt;
  if (!appt || typeof appt !== "object" || Array.isArray(appt)) return null;
  const id = (appt as Record<string, unknown>).id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/** Online (`appointment/book`): response `appointment_id` (distinct from request follow-up `appointment_id`). */
function readResponseAppointmentId(o: Record<string, unknown>): string | null {
  const v = o.appointment_id;
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function readAppointmentInfoOrderIdFromNestedData(
  layer: Record<string, unknown>,
  pick: (o: Record<string, unknown>) => string | null,
): string | null {
  const d = layer.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    return pick(d as Record<string, unknown>);
  }
  return null;
}

/** `info.id`, then scalar `id` / `order_id` on nested `data` or merged root — not `invoice_id`. */
function readAppointmentInfoOrderIdFallback(layerRec: Record<string, unknown>): string | null {
  const fromMergedInfo = readInfoIdFromRecord(layerRec);
  if (fromMergedInfo) return fromMergedInfo;

  const d = layerRec.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const dr = d as Record<string, unknown>;
    const fromNestedInfo = readInfoIdFromRecord(dr);
    if (fromNestedInfo) return fromNestedInfo;
    const fromDataScalars = readNonInvoiceScalarId(dr);
    if (fromDataScalars) return fromDataScalars;
  }

  return readNonInvoiceScalarId(layerRec);
}

export type ConsultationBookingChannel = "offline" | "online";

/**
 * Canonical id for Order ID on the booking-success summary.
 * - **offline** (at-hospital / network book): prefer `appt.id`
 * - **online** (virtual): prefer `appointment_id`
 * When `channel` is omitted, tries `appointment_id`, `appt.id`, then generic `info.id` / scalars.
 */
export function readAppointmentInfoOrderId(
  data: unknown,
  channel?: ConsultationBookingChannel,
): string | null {
  if (data == null || typeof data !== "object") return null;
  const layer = readAppointmentPaymentLayer(data);
  const layerRec = layer as Record<string, unknown>;

  if (channel === "offline") {
    const a = readApptNestedId(layerRec) ?? readAppointmentInfoOrderIdFromNestedData(layerRec, readApptNestedId);
    if (a) return a;
    return readAppointmentInfoOrderIdFallback(layerRec);
  }

  if (channel === "online") {
    const a =
      readResponseAppointmentId(layerRec) ??
      readAppointmentInfoOrderIdFromNestedData(layerRec, readResponseAppointmentId);
    if (a) return a;
    return readAppointmentInfoOrderIdFallback(layerRec);
  }

  const genericEarly =
    readResponseAppointmentId(layerRec) ??
    readApptNestedId(layerRec) ??
    readAppointmentInfoOrderIdFromNestedData(layerRec, readResponseAppointmentId) ??
    readAppointmentInfoOrderIdFromNestedData(layerRec, readApptNestedId);
  if (genericEarly) return genericEarly;

  return readAppointmentInfoOrderIdFallback(layerRec);
}

function pickInvoiceId(o: Record<string, unknown>): string | null {
  for (const k of ["invoice_id", "invoiceId"] as const) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Invoice row id for `/order/consultation/:invoiceId` after booking — never used for Order ID display. */
export function readAppointmentInvoiceIdForOrderDetail(data: unknown): string | null {
  if (data == null || typeof data !== "object") return null;
  const layer = readAppointmentPaymentLayer(data);
  let x = pickInvoiceId(layer as Record<string, unknown>);
  if (x) return x;
  const d = layer.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const dr = d as Record<string, unknown>;
    x = pickInvoiceId(dr);
    if (x) return x;
    const inv = dr.invoice;
    if (inv && typeof inv === "object" && !Array.isArray(inv)) {
      return pickInvoiceId(inv as Record<string, unknown>);
    }
  }
  return null;
}

/** POST `/appointment/book` and confirm responses (shape may include more fields). */
export type BookAppointmentBookResponse = Readonly<{
  paymentRequired?: boolean;
  isPaymentRequired?: boolean;
  payment_required?: boolean;
  message?: string;
  razorpay_payload?: Record<string, unknown>;
  data?: unknown;
}>;

/** POST `/appointment/book` */
export async function bookAppointment(
  payload: BookAppointmentPayload,
): Promise<BookAppointmentBookResponse> {
  return patientJson<BookAppointmentBookResponse>("appointment/book", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** POST `/appointment/book?status=confirm` — same body as {@link bookAppointment}. */
export async function bookAppointmentConfirm(
  payload: BookAppointmentPayload,
): Promise<BookAppointmentBookResponse> {
  return patientJson<BookAppointmentBookResponse>("appointment/book?status=confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
