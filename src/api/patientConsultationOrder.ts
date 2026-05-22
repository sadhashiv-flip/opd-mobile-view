import { patientJson } from "@/api/patientHttp";

/** PATCH `/patient/offline/appointment/confirm/:appointmentId` — partner reschedule confirm. */
export async function patchConsultationOfflineRescheduleConfirm(
  appointmentId: string,
): Promise<unknown> {
  const id = appointmentId.trim();
  if (!id) {
    throw new Error("Missing appointment id");
  }
  return patientJson<unknown>(`offline/appointment/confirm/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({}),
    skipGlobalLoading: true,
  });
}
