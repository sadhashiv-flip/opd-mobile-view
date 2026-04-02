import { patientFetch } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";
import type { RazorpayPaymentSuccess } from "@/types/razorpay-window";

/**
 * Backend must create a Razorpay order server-side (never expose Key Secret in the app).
 * Override with `VITE_RAZORPAY_CREATE_ORDER_PATH` / `VITE_RAZORPAY_VERIFY_PATH` if your routes differ.
 */
function createOrderPath(): string {
  const p = import.meta.env.VITE_RAZORPAY_CREATE_ORDER_PATH?.trim();
  return p && p.length > 0 ? p : "payments/razorpay/create-order";
}

function verifyPath(): string {
  const p = import.meta.env.VITE_RAZORPAY_VERIFY_PATH?.trim();
  return p && p.length > 0 ? p : "payments/razorpay/verify";
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

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export type RazorpayOrderForClient = Readonly<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string | null;
}>;

export type CreateGymRazorpayOrderInput = Readonly<{
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Readonly<Record<string, string>>;
}>;

/** POST create-order — expected JSON includes Razorpay order `id`, `amount` (paise), `currency`, optional `key_id`. */
export async function createGymRazorpayOrder(
  input: CreateGymRazorpayOrderInput,
): Promise<RazorpayOrderForClient> {
  const currency = input.currency?.trim() || "INR";
  const body = {
    amount: input.amountPaise,
    currency,
    receipt: input.receipt,
    notes: input.notes ?? {},
  };

  const res = await patientFetch(createOrderPath(), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  if (!text) throw new Error("Empty response from payment server");
  const raw = JSON.parse(text) as unknown;
  const o = unwrapData(raw);

  const orderId = str(o.id) || str(o.order_id);
  const amount = num(o.amount);
  const cur = str(o.currency, currency);
  const keyId = str(o.key_id) || null;

  if (!orderId) {
    throw new Error("Invalid create-order response: missing order id");
  }
  if (amount == null || amount <= 0) {
    throw new Error("Invalid create-order response: missing amount");
  }

  return {
    orderId,
    amount,
    currency: cur || "INR",
    keyId,
  };
}

/** POST verify — backend must validate `razorpay_signature` with Key Secret. */
export async function verifyGymRazorpayPayment(payment: RazorpayPaymentSuccess): Promise<void> {
  const res = await patientFetch(verifyPath(), {
    method: "POST",
    body: JSON.stringify({
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    }),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
