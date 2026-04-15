import { patientJson } from "@/api/patientHttp";

/**
 * PATCH `service/request/confirm/:serviceId` — partner / patient confirms updated details
 * (advances e.g. `info.status` 3 → 4). Used for vision, dental, and vaccine service request ids (`SR…`).
 */
export async function patchServiceRequestOrderConfirm(serviceId: string): Promise<unknown> {
  const id = serviceId.trim();
  if (!id) {
    throw new Error("Missing service id");
  }
  return patientJson<unknown>(`service/request/confirm/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: 4 }),
    skipGlobalLoading: true,
  });
}

/**
 * PATCH `service/request/cancel/:id` — vision, dental, vaccine (`info.id` / `SR…`).
 * Body matches {@link patchCancelServiceRequest} for parity with the appointment cancel flow.
 */
export async function patchServiceRequestOrderCancel(
  serviceRequestId: string,
  cancellationReason: string,
): Promise<unknown> {
  const id = serviceRequestId.trim();
  if (!id) {
    throw new Error("Missing service id");
  }
  const note = cancellationReason.trim();
  return patientJson<unknown>(`service/request/cancel/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ cancellation_reason: note }),
    skipGlobalLoading: true,
  });
}

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
