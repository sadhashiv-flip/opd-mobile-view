import { patientJson } from "@/api/patientHttp";

/** POST `/appointment/fulfill/:appointmentId` — Practo in-clinic QR check-in. */
export async function fulfillConsultationAppointment(
  appointmentId: string,
  body: Readonly<{
    fulfillment_type: string;
    qr_data: string;
  }>,
): Promise<unknown> {
  const id = appointmentId.trim();
  if (!id) throw new Error("Appointment id is missing.");
  return patientJson<unknown>(`appointment/fulfill/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({
      fulfillment_type: body.fulfillment_type.trim(),
      qr_data: body.qr_data.trim(),
    }),
  });
}
