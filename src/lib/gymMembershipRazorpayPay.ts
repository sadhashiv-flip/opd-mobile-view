import { createGymRazorpayOrder, verifyGymRazorpayPayment } from "@/api/patientRazorpay";
import type { RazorpayPaymentSuccess } from "@/types/razorpay-window";

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay requires a browser"));
  }
  if (window.Razorpay) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });

  return scriptPromise;
}

function sanitizeContact(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export type GymMembershipRazorpayPayParams = Readonly<{
  payableRupees: number;
  accountPrimaryUser: Readonly<{
    name: string;
    email: string;
    phone: string;
  }>;
  planId: string;
  secondaryPlanId?: string | null;
  gymInvoiceId?: string | null;
  subscriptionId?: string | null;
}>;

export class RazorpayPayCancelledError extends Error {
  readonly code = "RAZORPAY_CANCELLED" as const;
  constructor() {
    super("Payment cancelled");
    this.name = "RazorpayPayCancelledError";
  }
}

/**
 * Opens Razorpay Checkout for gym overview payable amount, then verifies payment on your API.
 */
export async function payGymMembershipWithRazorpay(
  params: GymMembershipRazorpayPayParams,
): Promise<RazorpayPaymentSuccess> {
  const envKey = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim();
  if (!envKey) {
    throw new Error(
      "Missing VITE_RAZORPAY_KEY_ID. Add your Razorpay Key Id (public) to .env for Checkout.",
    );
  }

  const amountPaise = Math.max(100, Math.round(params.payableRupees * 100));
  const receipt = `gym_${params.planId}_${Date.now()}`.slice(0, 40);

  const notes: Record<string, string> = {
    source: "gym_membership_overview",
    plan_id: params.planId,
  };
  if (params.secondaryPlanId) notes.secondary_plan_id = params.secondaryPlanId;
  if (params.gymInvoiceId) notes.gym_invoice_id = params.gymInvoiceId;
  if (params.subscriptionId) notes.subscription_id = params.subscriptionId;

  const order = await createGymRazorpayOrder({
    amountPaise,
    receipt,
    notes,
  });

  await loadRazorpayScript();

  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    throw new Error("Razorpay Checkout did not load");
  }

  const key = order.keyId ?? envKey;

  const prefillEmail =
    params.accountPrimaryUser.email.trim() &&
    params.accountPrimaryUser.email.trim() !== "—"
      ? params.accountPrimaryUser.email.trim()
      : undefined;
  const prefillContact = sanitizeContact(params.accountPrimaryUser.phone || "");

  return new Promise<RazorpayPaymentSuccess>((resolve, reject) => {
    const rzp = new Razorpay({
      key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: import.meta.env.VITE_RAZORPAY_BUSINESS_NAME?.trim() || "Gym membership",
      description: "Membership payment",
      prefill: {
        name: params.accountPrimaryUser.name.trim() || undefined,
        email: prefillEmail,
        contact: prefillContact || undefined,
      },
      theme: { color: "#0b0b0b" },
      handler(response) {
        resolve(response);
      },
      modal: {
        ondismiss() {
          reject(new RazorpayPayCancelledError());
        },
      },
    });

    rzp.on("payment.failed", (raw: unknown) => {
      const o = raw as { error?: { description?: string; reason?: string } };
      const msg = o.error?.description || o.error?.reason || "Payment failed";
      reject(new Error(msg));
    });

    rzp.open();
  }).then(async (success) => {
    await verifyGymRazorpayPayment(success);
    return success;
  });
}
