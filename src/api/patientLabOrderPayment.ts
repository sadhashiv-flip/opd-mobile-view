import { postDiagnosticsOrderRazorpayConfirm } from "@/api/patientDiagnosticsOrderConfirm";
import {
  parsePartnerOrderPaymentConfirmResponse,
  type PharmacyOrderPaymentConfirmResult,
  type PharmacyOrderPaymentVerifyBody,
} from "@/api/patientPharmacyOrderPayment";
import { patientJson } from "@/api/patientHttp";

function labOrderPaymentPath(labOrderId: string, query: Record<string, string | boolean>): string {
  const id = encodeURIComponent(labOrderId.trim());
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    q.set(k, typeof v === "boolean" ? (v ? "true" : "false") : v);
  }
  return `lab/order/payment/${id}?${q.toString()}`;
}

/** `PATCH lab/order/payment/:lab_order_id?useWallet=` — preview (parity with medicine / service request). */
export async function patchLabOrderPaymentPreview(
  labOrderId: string,
  useWallet: boolean,
): Promise<unknown> {
  const path = labOrderPaymentPath(labOrderId, { useWallet });
  return patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
}

export type LabOrderPaymentConfirmResult = PharmacyOrderPaymentConfirmResult;

/** `PATCH lab/order/payment/:lab_order_id?status=confirm&useWallet=` */
export async function patchLabOrderPaymentConfirm(
  labOrderId: string,
  useWallet: boolean,
): Promise<LabOrderPaymentConfirmResult> {
  const path = labOrderPaymentPath(labOrderId, { useWallet, status: "confirm" });
  const raw = await patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
  return parsePartnerOrderPaymentConfirmResponse(raw, labOrderId);
}

/**
 * After Razorpay on lab order pay — **`POST diagnostics/order/confirm`** with
 * `{ order_id, payment_id, invoice_id: "", src: "razorpay" }`.
 */
export async function verifyLabOrderPayment(body: PharmacyOrderPaymentVerifyBody): Promise<void> {
  await postDiagnosticsOrderRazorpayConfirm({
    order_id: body.order_id,
    payment_id: body.payment_id,
    invoice_id: body.invoice_id?.trim() ?? "",
  });
}
