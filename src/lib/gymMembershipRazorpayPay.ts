import { GYM_PAYMENT_DONE_EVENT } from "@/constants/gymPaymentEvents";

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

/** Resolve when `window.Razorpay` exists (script from index.html or injected here). */
export function loadRazorpayScript(): Promise<void> {
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

function paymentFailedMessage(raw: unknown): string {
  const o = raw as { error?: { description?: string; reason?: string } };
  return o.error?.description || o.error?.reason || "Payment failed";
}

/**
 * Opens Razorpay Checkout. Success path: dispatches {@link GYM_PAYMENT_DONE_EVENT} on `window` with payment `detail`.
 * Verify should run in a `useEffect` listener (not here).
 */
export function openRazorpayCheckout(
  razorpayPayload: Record<string, unknown>,
  onPaymentFailed: (message: string) => void,
): void {
  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    onPaymentFailed("Razorpay Checkout is not available");
    return;
  }

  const options: Record<string, unknown> = { ...razorpayPayload };

  options.handler = (response: unknown) => {
    window.dispatchEvent(new CustomEvent(GYM_PAYMENT_DONE_EVENT, { detail: response, bubbles: true }));
  };

  const prevModal =
    options.modal && typeof options.modal === "object" && !Array.isArray(options.modal)
      ? ({ ...(options.modal as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const userOndismiss = prevModal.ondismiss;
  prevModal.ondismiss = () => {
    if (typeof userOndismiss === "function") {
      (userOndismiss as () => void)();
    }
    onPaymentFailed("Payment cancelled");
  };
  options.modal = prevModal;

  const rzp = new Razorpay(options);
  rzp.on("payment.failed", (res: unknown) => {
    onPaymentFailed(paymentFailedMessage(res));
  });
  rzp.open();
}

export function isPaymentCancelledMessage(message: string): boolean {
  return message === "Payment cancelled";
}
