import type { PharmacyOrderPaymentVerifyBody } from "@/api/patientPharmacyOrderPayment";
import { verifyPharmacyOrderPayment } from "@/api/patientPharmacyOrderPayment";
import { PHARMACY_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import type { RazorpayPaymentSuccess } from "@/types/razorpay-window";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

function isSuccessDetail(d: unknown): d is RazorpayPaymentSuccess {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.razorpay_payment_id === "string" &&
    typeof o.razorpay_order_id === "string" &&
    typeof o.razorpay_signature === "string"
  );
}

type Refs = Readonly<{
  verifyOrderIdRef: MutableRefObject<string | null>;
  onSuccessRef: MutableRefObject<() => void>;
  onErrorRef: MutableRefObject<(message: string) => void>;
  setBusyRef: MutableRefObject<(busy: boolean) => void>;
  /**
   * When set, used instead of `verifyPharmacyOrderPayment` (e.g. `service/request/paymentverify`
   * for vision / dental / vaccine).
   */
  verifyPaymentRef?: MutableRefObject<(body: PharmacyOrderPaymentVerifyBody) => Promise<void>>;
  /**
   * When non-empty, merged into the verify body (lab `POST diagnostics/order/confirm` `invoice_id`;
   * medicine / service verify implementations ignore extra fields).
   */
  paymentVerifyInvoiceIdRef?: MutableRefObject<string | null>;
}>;

/**
 * After Razorpay success on `PHARMACY_PAYMENT_DONE_EVENT`, PATCHes payment verify
 * (`medicine/order/paymentverify` or `verifyPaymentRef`) with `order_id` and `payment_id`.
 */
export function usePharmacyOrderPaymentVerify(refs: Refs): void {
  const refsStable = useRef(refs);
  refsStable.current = refs;

  useEffect(() => {
    const verifiedPaymentIds = new Set<string>();

    const onDone = async (e: Event) => {
      const { verifyOrderIdRef, onSuccessRef, onErrorRef, setBusyRef } = refsStable.current;

      const detail = (e as CustomEvent<unknown>).detail;
      if (!isSuccessDetail(detail)) {
        onErrorRef.current("Invalid payment response");
        setBusyRef.current(false);
        return;
      }

      const pid = detail.razorpay_payment_id;
      if (verifiedPaymentIds.has(pid)) return;
      verifiedPaymentIds.add(pid);

      const orderId = verifyOrderIdRef.current?.trim() || detail.razorpay_order_id;

      try {
        const verify =
          refsStable.current.verifyPaymentRef?.current ?? verifyPharmacyOrderPayment;
        const inv = refsStable.current.paymentVerifyInvoiceIdRef?.current?.trim();
        const body: PharmacyOrderPaymentVerifyBody = {
          order_id: orderId,
          payment_id: detail.razorpay_payment_id,
          ...(inv ? { invoice_id: inv } : {}),
        };
        await verify(body);
        onSuccessRef.current();
      } catch (err) {
        verifiedPaymentIds.delete(pid);
        const msg = err instanceof Error ? err.message : "Verification failed";
        onErrorRef.current(msg);
        setBusyRef.current(false);
      }
    };

    window.addEventListener(PHARMACY_PAYMENT_DONE_EVENT, onDone);
    return () => window.removeEventListener(PHARMACY_PAYMENT_DONE_EVENT, onDone);
  }, []);
}
