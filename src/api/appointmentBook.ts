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
