import { verifyGymPayment } from "@/api/patientGymPayment";
import { GYM_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import type { RazorpayPaymentSuccess } from "@/types/razorpay-window";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

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
  invoiceIdRef: MutableRefObject<string | null>;
  internalOrderIdRef: MutableRefObject<string | null>;
  onSuccessRef: MutableRefObject<() => void>;
  onErrorRef: MutableRefObject<(message: string) => void>;
  setPayBusyRef: MutableRefObject<(busy: boolean) => void>;
}>;

/**
 * Listens for `gym.payment.done` from Razorpay handler, POSTs verify with latest invoice/order ids from refs.
 * Dedupes by `razorpay_payment_id` to reduce duplicate verify under React Strict Mode / double events.
 */
export function useGymPaymentVerify(refs: Refs): void {
  const refsStable = useRef(refs);
  refsStable.current = refs;

  useEffect(() => {
    const verifiedPaymentIds = new Set<string>();

    const onDone = async (e: Event) => {
      const { invoiceIdRef, internalOrderIdRef, onSuccessRef, onErrorRef, setPayBusyRef } =
        refsStable.current;

      const detail = (e as CustomEvent<unknown>).detail;
      if (!isSuccessDetail(detail)) {
        onErrorRef.current("Invalid payment response");
        setPayBusyRef.current(false);
        return;
      }

      const pid = detail.razorpay_payment_id;
      if (verifiedPaymentIds.has(pid)) return;
      verifiedPaymentIds.add(pid);

      const invoiceId = invoiceIdRef.current;
      if (!invoiceId) {
        verifiedPaymentIds.delete(pid);
        onErrorRef.current("Missing invoice id for verification");
        setPayBusyRef.current(false);
        return;
      }

      try {
        await verifyGymPayment({
          razorpay_order_id: detail.razorpay_order_id,
          razorpay_payment_id: detail.razorpay_payment_id,
          razorpay_signature: detail.razorpay_signature,
          invoice_id: invoiceId,
          order_id: internalOrderIdRef.current,
        });
        onSuccessRef.current();
      } catch (err) {
        verifiedPaymentIds.delete(pid);
        const msg = err instanceof Error ? err.message : "Verification failed";
        onErrorRef.current(msg);
        setPayBusyRef.current(false);
      }
    };

    window.addEventListener(GYM_PAYMENT_DONE_EVENT, onDone);
    return () => window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onDone);
  }, []);
}
