import { postDiagnosticsOrderRazorpayConfirm } from "@/api/patientDiagnosticsOrderConfirm";
import { DIAGNOSTICS_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
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

export type DiagnosticsRazorpayConfirmRefs = Readonly<{
  /**
   * When set (e.g. health checkup finalize), sent as `invoice_id` on **`POST …/diagnostics/order/confirm`**.
   * Lab order detail offline pay: omit or leave null so `invoice_id` is `""`.
   */
  invoiceIdRef?: MutableRefObject<string | null>;
  onSuccessRef: MutableRefObject<() => void>;
  onErrorRef: MutableRefObject<(message: string) => void>;
}>;

/**
 * After Razorpay Checkout.js on diagnostics flows, confirms with
 * **`POST …/diagnostics/order/confirm`** as `{ order_id, payment_id, invoice_id, src: "razorpay" }`.
 */
export function useDiagnosticsRazorpayConfirm(refs: DiagnosticsRazorpayConfirmRefs): void {
  const refsStable = useRef(refs);
  refsStable.current = refs;

  useEffect(() => {
    const verifiedPaymentIds = new Set<string>();

    const onDone = async (e: Event) => {
      const { invoiceIdRef, onSuccessRef, onErrorRef } = refsStable.current;
      const detail = (e as CustomEvent<unknown>).detail;
      if (!isSuccessDetail(detail)) {
        onErrorRef.current("Invalid payment response");
        return;
      }
      const pid = detail.razorpay_payment_id;
      if (verifiedPaymentIds.has(pid)) return;
      verifiedPaymentIds.add(pid);

      try {
        const inv = invoiceIdRef?.current?.trim() ?? "";
        await postDiagnosticsOrderRazorpayConfirm({
          order_id: detail.razorpay_order_id,
          payment_id: detail.razorpay_payment_id,
          invoice_id: inv,
        });
        onSuccessRef.current();
      } catch (err) {
        verifiedPaymentIds.delete(pid);
        onErrorRef.current(err instanceof Error ? err.message : "Confirmation failed");
      }
    };

    window.addEventListener(DIAGNOSTICS_PAYMENT_DONE_EVENT, onDone);
    return () => window.removeEventListener(DIAGNOSTICS_PAYMENT_DONE_EVENT, onDone);
  }, []);
}
