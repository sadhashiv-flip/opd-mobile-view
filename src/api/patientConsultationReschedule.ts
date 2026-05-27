import { patientJson } from "@/api/patientHttp";

export type PatchConsultationRescheduleBody = Readonly<{
  slot_id: string;
  time_slot: string;
  reschedule_reason?: string;
}>;

/** PATCH `/appointment/reschedule/:appointmentId` — vendor offline reschedule. */
export async function patchConsultationReschedule(
  appointmentId: string,
  body: PatchConsultationRescheduleBody,
): Promise<unknown> {
  const id = appointmentId.trim();
  if (!id) throw new Error("Appointment id is missing.");
  const payload: Record<string, string> = {
    slot_id: body.slot_id.trim(),
    time_slot: body.time_slot.trim(),
  };
  const reason = body.reschedule_reason?.trim();
  if (reason) payload.reschedule_reason = reason;
  return patientJson<unknown>(`appointment/reschedule/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
