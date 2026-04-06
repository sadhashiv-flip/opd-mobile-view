import { patientFetch } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";

function initPath(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_INIT_PATH?.trim();
  return p && p.length > 0 ? p : "gym/payment_init";
}

function verifyPath(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_VERIFY_PATH?.trim();
  return p && p.length > 0 ? p : "gym/payment_verify";
}

function confirmPath(): string {
  const p = import.meta.env.VITE_GYM_PAYMENT_CONFIRM_PATH?.trim();
  return p && p.length > 0 ? p : "gym/payment_confirm";
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

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
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

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/**
 * Start gym checkout: server creates Razorpay order (if needed) and returns payload for Checkout.js.
 */
export async function initGymPayment(body: GymPaymentInitRequest): Promise<GymPaymentInitResult> {
  const res = await patientFetch(initPath(), {
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

  const pr = o.payment_required;
  const paymentRequired = !(pr === false || pr === "false" || pr === 0);

  const payloadRaw = o.razorpay_payload;
  const razorpay_payload = paymentRequired ? asRecord(payloadRaw) : null;

  return {
    payment_required: paymentRequired,
    razorpay_payload,
    invoice_id: str(o.invoice_id),
    order_id: str(o.order_id),
  };
}

export type GymPaymentVerifyRequest = Readonly<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  invoice_id: string;
  order_id?: string | null;
}>;

/** POST gym/payment_verify — server HMAC verify + activate membership. */
export async function verifyGymPayment(body: GymPaymentVerifyRequest): Promise<void> {
  const payload: Record<string, unknown> = {
    razorpay_order_id: body.razorpay_order_id,
    razorpay_payment_id: body.razorpay_payment_id,
    razorpay_signature: body.razorpay_signature,
    invoice_id: body.invoice_id,
  };
  if (body.order_id) payload.order_id = body.order_id;

  const res = await patientFetch(verifyPath(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}

export type GymPaymentConfirmFreeRequest = Readonly<{
  invoice_id: string;
  order_id?: string | null;
}>;

/** When payment_required is false — confirm membership without Razorpay. */
export async function confirmGymPaymentFree(body: GymPaymentConfirmFreeRequest): Promise<void> {
  const payload: Record<string, unknown> = { invoice_id: body.invoice_id };
  if (body.order_id) payload.order_id = body.order_id;

  const res = await patientFetch(confirmPath(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
