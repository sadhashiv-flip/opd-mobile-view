import { readPatientApiError } from "@/api/patientClient";
import { patientFetch } from "@/api/patientHttp";

/**
 * `PATCH {apiUrl}/lab/cancel/:invoiceInfoId` — mirror patient_app lab order cancellation.
 *
 * @param invoiceInfoId `info.id` on the lab invoice (`consultationInfoId` on detail).
 */
export async function patchLabOrderCancel(
  invoiceInfoId: string,
  body: Readonly<{ cancellation_reason: string }>,
): Promise<void> {
  const id = invoiceInfoId.trim();
  if (!id) {
    throw new Error("Missing booking id");
  }
  const reason = body.cancellation_reason.trim();
  if (!reason) {
    throw new Error("Please enter cancellation reason");
  }
  const res = await patientFetch(`lab/cancel/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ cancellation_reason: reason }),
    skipGlobalLoading: true,
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
}
