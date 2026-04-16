import { readPatientApiError } from "@/api/patientClient";
import { patientFetch } from "@/api/patientHttp";

/**
 * `PATCH {apiUrl}/lab/order/confirm/:serviceId` — confirm assigned center / details when lab order `info.status === 3`.
 * Distinct from `POST …/diagnostics/order/confirm` (booking / Razorpay confirm with `src: "razorpay"`, etc.).
 *
 * @param serviceId Lab service / booking line id (e.g. `data.info.id` on the invoice).
 */
export async function patchLabOrderConfirm(serviceId: string): Promise<void> {
  const sid = serviceId.trim();
  if (!sid) {
    throw new Error("Missing lab order id");
  }
  const res = await patientFetch(`lab/order/confirm/${encodeURIComponent(sid)}`, {
    method: "PATCH",
    skipGlobalLoading: true,
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
