import { readPatientApiError } from "@/api/patientClient";
import {
  parsePartnerOrderPaymentConfirmResponse,
  type PharmacyOrderPaymentConfirmResult,
  type PharmacyOrderPaymentVerifyBody,
} from "@/api/patientPharmacyOrderPayment";
import { patientFetch, patientJson } from "@/api/patientHttp";

function serviceRequestOrderPaymentPath(
  serviceRequestId: string,
  query: Record<string, string | boolean>,
): string {
  const id = encodeURIComponent(serviceRequestId.trim());
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    q.set(k, typeof v === "boolean" ? (v ? "true" : "false") : v);
  }
  return `service/request/payment/${id}?${q.toString()}`;
}

/** `PATCH service/request/payment/:service_request_id?useWallet=` — preview (parity with medicine order). */
export async function patchServiceRequestOrderPaymentPreview(
  serviceRequestId: string,
  useWallet: boolean,
): Promise<unknown> {
  const path = serviceRequestOrderPaymentPath(serviceRequestId, { useWallet });
  return patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
}

export type ServiceRequestOrderPaymentConfirmResult = PharmacyOrderPaymentConfirmResult;

/** `PATCH service/request/payment/:service_request_id?status=confirm&useWallet=` */
export async function patchServiceRequestOrderPaymentConfirm(
  serviceRequestId: string,
  useWallet: boolean,
): Promise<ServiceRequestOrderPaymentConfirmResult> {
  const path = serviceRequestOrderPaymentPath(serviceRequestId, { useWallet, status: "confirm" });
  const raw = await patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
  return parsePartnerOrderPaymentConfirmResponse(raw, serviceRequestId);
}

/** `PATCH service/request/paymentverify` — same body as medicine order verify. */
export async function verifyServiceRequestOrderPayment(body: PharmacyOrderPaymentVerifyBody): Promise<void> {
  const res = await patientFetch("service/request/paymentverify", {
    method: "PATCH",
    body: JSON.stringify({
      order_id: body.order_id,
      payment_id: body.payment_id,
    }),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
