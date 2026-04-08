import { patientFetchChecked } from "@/api/patientHttp";

export type MedicineOrderPrescription =
  | Readonly<{ type: "OTHER"; prescription_id: string }>
  | Readonly<{ type: "FLIPHEALTH"; prescription_id: string }>;

export type PostMedicineOrderPayload = Readonly<{
  address_id: string;
  prescriptions: readonly MedicineOrderPrescription[];
  patient_id: number;
}>;

/** POST `/medicine` — OTC uses `prescriptions: []`. */
export async function postMedicineOrder(payload: PostMedicineOrderPayload): Promise<void> {
  await patientFetchChecked("medicine", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
