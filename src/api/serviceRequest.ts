import { patientJson } from "@/api/patientHttp";

/**
 * PATCH `appointment/cancel/:serviceId` — `serviceId` is typically invoice `info.id`
 * (consultation appointment, pharmacy medicine order, …).
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
