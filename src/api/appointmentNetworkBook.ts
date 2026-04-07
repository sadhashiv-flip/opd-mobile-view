import { patientJson } from "@/api/patientHttp";

export type NetworkBookAppointmentPayload = Readonly<{
  doctor_id: string;
  network_id: string;
  time_slot: string;
  speciality_id: number;
  address_id: string;
  patient_id: number;
}>;

/** POST `/appointment/network_book` */
export async function networkBookAppointment(
  payload: NetworkBookAppointmentPayload,
): Promise<unknown> {
  return patientJson<unknown>("appointment/network_book", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
