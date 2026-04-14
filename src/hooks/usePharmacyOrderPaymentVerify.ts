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
}>;

/**
 * After Razorpay success on {@link PHARMACY_PAYMENT_DONE_EVENT}, PATCHes `medicine/order/paymentverify`
 * with `order_id` (from confirm response when set, else Razorpay order id) and `payment_id`.
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
        await verifyPharmacyOrderPayment({
          order_id: orderId,
          payment_id: detail.razorpay_payment_id,
        });
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
