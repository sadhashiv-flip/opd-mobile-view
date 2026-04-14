const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Checkout.js often returns HTTP 400 when `currency` is missing, `prefill.contact` is sent as a number,
 * or the gateway nests options under `options` / `checkout` while the parent object is not valid input.
 */
export function normalizeRazorpayCheckoutPayload(payload: Record<string, unknown>): Record<string, unknown> {
  let o: Record<string, unknown> = { ...payload };

  for (const nestKey of ["options", "checkout", "payload", "razorpay_options"] as const) {
    const ir = asRecord(o[nestKey]);
    if (ir != null && (typeof ir.key === "string" || typeof ir.order_id === "string")) {
      o = { ...o, ...ir };
      break;
    }
  }

  delete o.options;
  delete o.checkout;
  delete o.payload;
  delete o.razorpay_options;

  if (typeof o.key !== "string" || !o.key.trim()) {
    const kid = o.key_id ?? o.keyId;
    if (typeof kid === "string" && kid.trim()) o.key = kid.trim();
  }

  const oid = o.order_id ?? o.orderId;
  if (typeof oid === "string" && oid.trim()) {
    o.order_id = oid.trim();
    delete o.orderId;
  }

  if (typeof o.currency !== "string" || !o.currency.trim()) {
    o.currency = "INR";
  }

  const amount = o.amount;
  if (typeof amount === "string" && /^\d+(\.\d+)?$/.test(amount.trim())) {
    const t = amount.trim();
    o.amount = t.includes(".") ? Math.round(Number.parseFloat(t)) : Number.parseInt(t, 10);
  }

  const prefill = asRecord(o.prefill);
  if (prefill != null) {
    const next: Record<string, unknown> = { ...prefill };
    for (const k of ["contact", "email", "name"] as const) {
      const v = next[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        next[k] = String(v);
      }
    }
    o.prefill = next;
  }

  return o;
}

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
 * Opens Razorpay Checkout. On success, dispatches a `CustomEvent` on `window` with Razorpay `detail`
 * (use {@link PAYMENT_DONE_EVENT}, {@link PAYMENT_SUCCESS_EVENT}, or {@link GYM_PAYMENT_DONE_EVENT}).
 */
export function openRazorpayCheckoutWithEvent(
  razorpayPayload: Record<string, unknown>,
  successEventName: string,
  onPaymentFailed: (message: string) => void,
): void {
  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    onPaymentFailed("Razorpay Checkout is not available");
    return;
  }

  const options: Record<string, unknown> = normalizeRazorpayCheckoutPayload({ ...razorpayPayload });

  options.handler = (response: unknown) => {
    window.dispatchEvent(
      new CustomEvent(successEventName, { detail: response, bubbles: true, cancelable: true }),
    );
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
