import { readAppointmentPaymentLayer } from "@/api/appointmentBook";
import { readPatientApiError } from "@/api/patientClient";
import { patientFetch, patientJson } from "@/api/patientHttp";
import { readRazorpayPayloadFromPaymentEnvelope } from "@/lib/razorpayCheckout";

function gymPaymentResourceBase(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_PATH?.trim();
  return p && p.length > 0 ? p.replace(/\/$/, "") : "gym/payment";
}

function gymPaymentPath(invoiceId: string, query: Record<string, string | boolean>): string {
  const id = encodeURIComponent(invoiceId.trim());
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    q.set(k, typeof v === "boolean" ? String(v) : v);
  }
  return `${gymPaymentResourceBase()}/${id}?${q.toString()}`;
}

/** POST target to create/open checkout (same resource family as {@link gymPaymentPath}). */
function gymPaymentCreatePath(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_INIT_PATH?.trim();
  if (p && p.length > 0) return p.replace(/^\//, "");
  return gymPaymentResourceBase();
}

function verifyPath(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_VERIFY_PATH?.trim();
  return p && p.length > 0 ? p : "gym/payment_verify";
}

function confirmPathLegacy(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_CONFIRM_PATH?.trim();
  return p && p.length > 0 ? p : "";
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function unwrapData(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const inner = o.data;
  if (inner && typeof inner === "object") {
    return inner as Record<string, unknown>;
  }
  return o;
}

function paymentRequiredFromGymPatch(raw: unknown): boolean {
  const layer = readAppointmentPaymentLayer(raw) as Record<string, unknown>;
  const pr = layer.paymentRequired ?? layer.payment_required;
  if (pr === false || pr === "false" || pr === 0) return false;
  const rzp = readRazorpayPayloadFromPaymentEnvelope(layer);
  if (rzp != null && Object.keys(rzp).length > 0) return true;
  return pr === true || pr === "true" || pr === 1;
}

function parseGymPatchConfirmRaw(raw: unknown, fallbackInvoiceId: string): GymPaymentInitResult {
  const layer = readAppointmentPaymentLayer(raw) as Record<string, unknown>;
  const payment_required = paymentRequiredFromGymPatch(raw);
  const razorpay_payload = payment_required ? readRazorpayPayloadFromPaymentEnvelope(layer) : null;
  return {
    payment_required,
    razorpay_payload,
    invoice_id: str(layer.invoice_id) ?? (fallbackInvoiceId.trim() || null),
    order_id: str(layer.order_id),
  };
}

export type GymPaymentInitRequest = Readonly<{
  payable_rupees: number;
  amount_paise: number;
  plan_id: string;
  primary_plan_id: string;
  secondary_plan_id?: string | null;
  subscription_id?: string | null;
  gym_invoice_id?: string | null;
  show_secondary?: boolean;
}>;

export type GymPaymentInitResult = Readonly<{
  payment_required: boolean;
  razorpay_payload: Record<string, unknown> | null;
  invoice_id: string | null;
  order_id: string | null;
}>;

/**
 * Preview totals / wallet — `PATCH gym/payment/:invoice_id?useWallet=` (parity with offline appointment payment).
 */
export async function patchGymPaymentPreview(invoiceId: string, useWallet: boolean): Promise<unknown> {
  const path = gymPaymentPath(invoiceId, { useWallet });
  return patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
}

/**
 * Confirm / load Razorpay — `PATCH gym/payment/:invoice_id?useWallet=&status=confirm`
 * (parity with `PATCH offline/appointment/payment/:id?...`).
 */
export async function patchGymPaymentConfirm(
  invoiceId: string,
  useWallet: boolean,
): Promise<GymPaymentInitResult> {
  const path = gymPaymentPath(invoiceId, { useWallet, status: "confirm" });
  const raw = await patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
  return parseGymPatchConfirmRaw(raw, invoiceId);
}

/**
 * Start gym checkout when there is no invoice yet — `POST gym/payment` with plan + amounts
 * (same payment resource as {@link patchGymPaymentConfirm}; legacy: set `VITE_GYM_PAYMENT_INIT_PATH=gym/payment_init`).
 * When an invoice already exists, prefer {@link patchGymPaymentConfirm}.
 */
export async function initGymPayment(body: GymPaymentInitRequest): Promise<GymPaymentInitResult> {
  const res = await patientFetch(gymPaymentCreatePath(), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  if (!text) throw new Error("Empty payment init response");
  const raw = JSON.parse(text) as unknown;
  const o = unwrapData(raw);
  const payment_required = paymentRequiredFromGymPatch(raw);
  const layer = readAppointmentPaymentLayer(raw) as Record<string, unknown>;
  const razorpay_payload = payment_required ? readRazorpayPayloadFromPaymentEnvelope(layer) : null;

  return {
    payment_required,
    razorpay_payload,
    invoice_id: str(o.invoice_id),
    order_id: str(o.order_id),
  };
}

/** POST `gym/payment_verify` — body matches server `GymController.paymentVerify`. */
export type GymPaymentVerifyRequest = Readonly<{
  invoice_id: string;
  payment_id: string;
}>;

export async function verifyGymPayment(body: GymPaymentVerifyRequest): Promise<void> {
  const res = await patientFetch(verifyPath(), {
    method: "POST",
    body: JSON.stringify({
      invoice_id: body.invoice_id,
      payment_id: body.payment_id,
    }),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}

export type GymPaymentConfirmFreeRequest = Readonly<{
  invoice_id: string;
  order_id?: string | null;
  /** Match wallet toggle used for payable (default false). */
  use_wallet?: boolean;
}>;

/**
 * When `payment_required` is false after init — confirm via `PATCH gym/payment/:id?useWallet=&status=confirm`
 * (same resource as offline appointment confirm).
 */
export async function confirmGymPaymentFree(body: GymPaymentConfirmFreeRequest): Promise<void> {
  const useWallet = body.use_wallet === true;
  const legacy = confirmPathLegacy();
  if (legacy.length > 0) {
    const payload: Record<string, unknown> = { invoice_id: body.invoice_id };
    if (body.order_id) payload.order_id = body.order_id;
    const res = await patientFetch(legacy, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readPatientApiError(res));
    }
    return;
  }
  await patientJson<unknown>(gymPaymentPath(body.invoice_id, { useWallet, status: "confirm" }), {
    method: "PATCH",
    skipGlobalLoading: true,
  });
}
