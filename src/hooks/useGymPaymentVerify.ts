import { verifyGymPayment } from "@/api/patientGymPayment";
import { GYM_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
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
  invoiceIdRef: MutableRefObject<string | null>;
  onSuccessRef: MutableRefObject<() => void>;
  onErrorRef: MutableRefObject<(message: string) => void>;
  setPayBusyRef: MutableRefObject<(busy: boolean) => void>;
}>;

/**
 * Listens for `gym.payment.done` from Razorpay; POSTs `gym/payment_verify` with `{ invoice_id, payment_id }`.
 * Dedupes by `razorpay_payment_id` to reduce duplicate verify under React Strict Mode / double events.
 */
export function useGymPaymentVerify(refs: Refs): void {
  const refsStable = useRef(refs);
  refsStable.current = refs;

  useEffect(() => {
    const verifiedPaymentIds = new Set<string>();

    const onDone = async (e: Event) => {
      const { invoiceIdRef, onSuccessRef, onErrorRef, setPayBusyRef } = refsStable.current;

      const detail = (e as CustomEvent<unknown>).detail;
      if (!isSuccessDetail(detail)) {
        onErrorRef.current("Invalid payment response");
        setPayBusyRef.current(false);
        return;
      }

      const pid = detail.razorpay_payment_id;
      if (verifiedPaymentIds.has(pid)) return;
      verifiedPaymentIds.add(pid);

      const invoiceId = invoiceIdRef.current?.trim() ?? "";
      if (!invoiceId) {
        verifiedPaymentIds.delete(pid);
        onErrorRef.current("Missing invoice id for payment verification");
        setPayBusyRef.current(false);
        return;
      }

      try {
        await verifyGymPayment({
          invoice_id: invoiceId,
          payment_id: detail.razorpay_payment_id,
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
