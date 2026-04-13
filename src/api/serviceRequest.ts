import { patientJson } from "@/api/patientHttp";

/**
 * PATCH `/service/request/cancel/:serviceId` — `serviceId` is consultation `info.id`
 * from the invoice payload.
 */
export async function patchCancelServiceRequest(
  serviceId: string,
  cancellationReason: string,
): Promise<unknown> {
  const id = serviceId.trim();
  if (!id) {
    throw new Error("Missing service id");
  }
  const note = cancellationReason.trim();
  return patientJson<unknown>(`appointment/cancel/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ cancellation_reason: note }),
    skipGlobalLoading: true,
  });
}
