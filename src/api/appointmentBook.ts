import { patientJson } from "@/api/patientHttp";

export type BookAppointmentPayload = Readonly<{
  date: string;
  time: string;
  language: string;
  patient_id: number;
  issue_id: number;
  purpose: string;
}>;

/** POST `/appointment/book` */
export async function bookAppointment(payload: BookAppointmentPayload): Promise<unknown> {
  return patientJson<unknown>("appointment/book", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
