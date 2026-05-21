import { verifyAppointmentPayment } from "@/api/patientConsultationPayment";
import { PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
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

export type ConsultationPaymentVerifySuccess = Readonly<{
  message?: string;
  paymentId?: string;
  gatewayOrderId?: string;
}>;

type Refs = Readonly<{
  onSuccessRef: MutableRefObject<(result?: ConsultationPaymentVerifySuccess) => void>;
  onErrorRef: MutableRefObject<(message: string) => void>;
  setBusyRef: MutableRefObject<(busy: boolean) => void>;
}>;

/**
 * Listens for Angular-parity `payment.done` after Checkout.js handler; PATCHes `appointment/paymentverify`.
 */
export function useConsultationPaymentVerify(refs: Refs): void {
  const refsStable = useRef(refs);
  refsStable.current = refs;

  useEffect(() => {
    const verifiedPaymentIds = new Set<string>();

    const onDone = async (e: Event) => {
      const { onSuccessRef, onErrorRef, setBusyRef } = refsStable.current;

      const detail = (e as CustomEvent<unknown>).detail;
      if (!isSuccessDetail(detail)) {
        onErrorRef.current("Invalid payment response");
        setBusyRef.current(false);
        return;
      }

      const pid = detail.razorpay_payment_id;
      if (verifiedPaymentIds.has(pid)) return;
      verifiedPaymentIds.add(pid);

      try {
        const { message } = await verifyAppointmentPayment({
          order_id: detail.razorpay_order_id,
          payment_id: detail.razorpay_payment_id,
          signature: detail.razorpay_signature,
        });
        onSuccessRef.current({
          message,
          paymentId: detail.razorpay_payment_id,
          gatewayOrderId: detail.razorpay_order_id,
        });
      } catch (err) {
        verifiedPaymentIds.delete(pid);
        const msg = err instanceof Error ? err.message : "Verification failed";
        onErrorRef.current(msg);
        setBusyRef.current(false);
      }
    };

    window.addEventListener(PAYMENT_DONE_EVENT, onDone);
    return () => window.removeEventListener(PAYMENT_DONE_EVENT, onDone);
  }, []);
}
