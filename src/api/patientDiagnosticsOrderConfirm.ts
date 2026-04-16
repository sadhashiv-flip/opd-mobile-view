import { patientFetch } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";

/**
 * POST `{apiUrl}/diagnostics/order/confirm` — **booking flow** (cart overview finalize, zero-amount, etc.).
 * Body varies by caller (e.g. `{ invoice_id, payment_id }`).
 *
 * Lab order **detail** confirmation when `info.status === 3` uses `PATCH …/lab/order/confirm/:serviceId`
 * (`patchLabOrderConfirm` in `patientLabOrderConfirm.ts`); do not use this module for that step.
 */
export async function confirmDiagnosticsOrder(body: Record<string, unknown>): Promise<void> {
  const res = await patientFetch("diagnostics/order/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}

export type DiagnosticsRazorpayPostConfirmBody = Readonly<{
  order_id: string;
  payment_id: string;
  /** Lab order pay: often `""`. Health booking after Razorpay: invoice id from finalize. */
  invoice_id?: string;
}>;

/**
 * POST `{apiUrl}/diagnostics/order/confirm` — **after Razorpay** (lab order payment verify, diagnostics checkout).
 * Body: `{ order_id, payment_id, invoice_id, src: "razorpay" }`.
 */
export async function postDiagnosticsOrderRazorpayConfirm(
  body: DiagnosticsRazorpayPostConfirmBody,
): Promise<void> {
  const res = await patientFetch("diagnostics/order/confirm", {
    method: "POST",
    body: JSON.stringify({
      order_id: body.order_id.trim(),
      payment_id: body.payment_id.trim(),
      invoice_id: body.invoice_id?.trim() ?? "",
      src: "razorpay",
    }),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
