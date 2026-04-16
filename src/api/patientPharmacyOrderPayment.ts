import {
  readAppointmentPaymentLayer,
  readAppointmentResponseMessage,
} from "@/api/appointmentBook";
import { readPatientApiError } from "@/api/patientClient";
import { patientFetch, patientJson } from "@/api/patientHttp";
import { normalizeRazorpayCheckoutPayload } from "@/lib/razorpayCheckout";

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Some APIs return the Checkout options as a JSON string. */
function parseMaybeJsonObject(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t.startsWith("{")) return null;
    try {
      const parsed: unknown = JSON.parse(t);
      return asRecord(parsed);
    } catch {
      return null;
    }
  }
  return asRecord(v);
}

function looksLikeRazorpayCheckoutOptions(rec: Record<string, unknown>): boolean {
  return (
    typeof rec.key === "string" ||
    typeof rec.order_id === "string" ||
    typeof rec.amount === "number" ||
    rec.amount != null
  );
}

/** Orders flow: needs key + Razorpay order id + positive amount (paise). */
function isRazorpayOrderCheckoutShape(rec: Record<string, unknown>): boolean {
  const key = typeof rec.key === "string" && rec.key.trim().length > 0;
  const order = typeof rec.order_id === "string" && rec.order_id.trim().length > 0;
  const a = rec.amount;
  const amtOk =
    (typeof a === "number" && Number.isFinite(a) && a > 0) ||
    (typeof a === "string" && /^\d+$/.test(a.trim()) && Number.parseInt(a.trim(), 10) > 0);
  return key && order && amtOk;
}

/**
 * Reads `razorpay_payload` (and common alternates / nesting) from `PATCH medicine/order/payment/...` JSON.
 */
function readRazorpayPayloadFromPharmacyConfirm(raw: unknown): Record<string, unknown> | null {
  const layer = readAppointmentPaymentLayer(raw);
  const candidates: unknown[] = [];

  const pushFrom = (rec: Record<string, unknown> | null): void => {
    if (!rec) return;
    candidates.push(
      rec.razorpay_payload,
      rec.razorpayPayload,
      rec.razorpay,
      rec.checkout_payload,
      rec.checkoutPayload,
      rec.gateway_payload,
      rec.gatewayPayload,
      rec.payment_payload,
      rec.paymentPayload,
    );
  };

  pushFrom(layer);
  pushFrom(asRecord(layer.data));
  pushFrom(asRecord(layer.result));
  pushFrom(asRecord(layer.payment));
  const resultData = asRecord(asRecord(layer.result)?.data);
  pushFrom(resultData);
  const info = asRecord(layer.info);
  pushFrom(info);
  pushFrom(asRecord(info?.data));

  const normalized: Record<string, unknown>[] = [];
  for (const c of candidates) {
    const rec = parseMaybeJsonObject(c);
    if (rec != null && Object.keys(rec).length > 0) {
      normalized.push(normalizeRazorpayCheckoutPayload(rec));
    }
  }

  for (const n of normalized) {
    if (isRazorpayOrderCheckoutShape(n)) return n;
  }

  for (const n of normalized) {
    if (typeof n.key === "string" && n.key.trim() && typeof n.order_id === "string" && n.order_id.trim()) {
      return n;
    }
  }

  for (const n of normalized) {
    if (looksLikeRazorpayCheckoutOptions(n)) return n;
  }

  return null;
}

function pharmacyOrderPaymentPath(
  medicineOrderId: string,
  query: Record<string, string | boolean>,
): string {
  const id = encodeURIComponent(medicineOrderId.trim());
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    q.set(k, typeof v === "boolean" ? (v ? "true" : "false") : v);
  }
  return `medicine/order/payment/${id}?${q.toString()}`;
}

/** `PATCH medicine/order/payment/:medicine_order_id?useWallet=` — preview totals (same sheet as offline consult). */
export async function patchPharmacyOrderPaymentPreview(
  medicineOrderId: string,
  useWallet: boolean,
): Promise<unknown> {
  const path = pharmacyOrderPaymentPath(medicineOrderId, { useWallet });
  return patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
}

export type PharmacyOrderPaymentConfirmResult = Readonly<{
  paymentRequired: boolean;
  razorpayPayload: Record<string, unknown> | null;
  message?: string;
  /** Prefer for `medicine/order/paymentverify` `order_id` when the server returns it on confirm. */
  verifyOrderId: string | null;
  /**
   * When the confirm JSON includes an invoice id (e.g. lab → `POST diagnostics/order/confirm` after Razorpay).
   */
  invoiceIdForDiagnosticsConfirm: string | null;
}>;

function pharmacyConfirmPaymentRequired(
  raw: unknown,
  razorpayPayload: Record<string, unknown> | null,
): boolean {
  const layer = readAppointmentPaymentLayer(raw);
  const pr = layer.isPaymentRequired ?? layer.paymentRequired ?? layer.payment_required;
  if (pr === false || pr === "false" || pr === 0) return false;
  if (razorpayPayload != null && Object.keys(razorpayPayload).length > 0) return true;
  return pr === true || pr === "true" || pr === 1;
}

function readVerifyOrderId(
  raw: unknown,
  fallbackServiceOrMedicineOrderId: string,
  razorpayPayload: Record<string, unknown> | null,
): string | null {
  const layer = readAppointmentPaymentLayer(raw);
  const mid = fallbackServiceOrMedicineOrderId.trim();
  const fromRzp = razorpayPayload != null ? str(razorpayPayload.order_id) : null;
  return (
    str(layer.order_id) ??
    str(layer.orderId) ??
    str(layer.medicine_order_id) ??
    str(layer.service_request_id) ??
    str(layer.serviceRequestId) ??
    fromRzp ??
    (mid.length > 0 ? mid : null)
  );
}

/** `invoice_id` / `invoiceId` on confirm envelope (lab payment, etc.). */
function readInvoiceIdFromPartnerPaymentConfirmRaw(raw: unknown): string | null {
  const layer = readAppointmentPaymentLayer(raw);
  const data = asRecord(layer.data);
  return (
    str(layer.invoice_id) ??
    str(layer.invoiceId) ??
    (data ? str(data.invoice_id) ?? str(data.invoiceId) : null)
  );
}

/** Shared parser for `PATCH …/payment/:id?status=confirm` (medicine order + service request). */
export function parsePartnerOrderPaymentConfirmResponse(
  raw: unknown,
  fallbackVerifyOrderId: string,
): PharmacyOrderPaymentConfirmResult {
  const razorpayPayload = readRazorpayPayloadFromPharmacyConfirm(raw);
  return {
    paymentRequired: pharmacyConfirmPaymentRequired(raw, razorpayPayload),
    razorpayPayload,
    message: readAppointmentResponseMessage(raw),
    verifyOrderId: readVerifyOrderId(raw, fallbackVerifyOrderId, razorpayPayload),
    invoiceIdForDiagnosticsConfirm: readInvoiceIdFromPartnerPaymentConfirmRaw(raw),
  };
}

/** `PATCH medicine/order/payment/:medicine_order_id?status=confirm&useWallet=` */
export async function patchPharmacyOrderPaymentConfirm(
  medicineOrderId: string,
  useWallet: boolean,
): Promise<PharmacyOrderPaymentConfirmResult> {
  const path = pharmacyOrderPaymentPath(medicineOrderId, { useWallet, status: "confirm" });
  const raw = await patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
  return parsePartnerOrderPaymentConfirmResponse(raw, medicineOrderId);
}

export type PharmacyOrderPaymentVerifyBody = Readonly<{
  order_id: string;
  payment_id: string;
  /** Lab `POST diagnostics/order/confirm` only; omit for medicine / service request verify. */
  invoice_id?: string;
}>;

/** `PATCH medicine/order/paymentverify` */
export async function verifyPharmacyOrderPayment(body: PharmacyOrderPaymentVerifyBody): Promise<void> {
  const res = await patientFetch("medicine/order/paymentverify", {
    method: "PATCH",
    body: JSON.stringify({
      order_id: body.order_id,
      payment_id: body.payment_id,
    }),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
