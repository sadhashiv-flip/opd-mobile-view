import { patientFetch } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";

/**
 * POST `{apiUrl}/diagnostics/order/confirm` — body shape depends on flow (Angular parity):
 * - Paid lab (RF book): `{ order_id, payment_id, signature }`
 * - Free / no Razorpay: `{ src: "self", order_id }`
 * - Invoice / AHC-style: `{ invoice_id, payment_id }` (signature optional per backend)
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
