import { patientJson } from "@/api/patientHttp";

export type LegacyNetworkBookAppointmentPayload = Readonly<{
  doctor_id: string;
  network_id: string;
  time_slot: string;
  speciality_id: number;
  address_id: string;
  patient_id: number;
}>;

export type VendorNetworkBookMeta = Readonly<{
  source: string;
  practice_id: string;
  doctor_id: string;
  consultation_price: number | null;
  network: Readonly<{
    name: string;
    display_address: string;
    coordinates: string;
  }>;
  doctor: Readonly<{
    name: string;
    gender: string;
    qualification: string;
  }>;
}>;

export type VendorNetworkBookAppointmentPayload = Readonly<{
  patient_id: number;
  speciality_id: number;
  address_id: string | number;
  time_slot: string;
  vendor_code: string;
  network_id: string;
  doctor_id: string;
  slot_id: string;
  vendor_meta: VendorNetworkBookMeta;
}>;

export type NetworkBookAppointmentPayload =
  | LegacyNetworkBookAppointmentPayload
  | VendorNetworkBookAppointmentPayload;

export function isVendorNetworkBookPayload(
  p: NetworkBookAppointmentPayload,
): p is VendorNetworkBookAppointmentPayload {
  return "vendor_code" in p && "slot_id" in p && "vendor_meta" in p;
}

/** POST `/appointment/network_book` — preview quote when `confirm` is false (patient_app `bookOfflineAppointment`). */
export async function networkBookAppointment(
  payload: NetworkBookAppointmentPayload,
  options?: Readonly<{ confirm?: boolean }>,
): Promise<unknown> {
  const confirm = options?.confirm === true;
  const path = confirm ? "appointment/network_book?status=confirm" : "appointment/network_book";
  return patientJson<unknown>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function networkBookAppointmentPreview(
  payload: NetworkBookAppointmentPayload,
): Promise<unknown> {
  return networkBookAppointment(payload, { confirm: false });
}

export function networkBookAppointmentConfirm(
  payload: NetworkBookAppointmentPayload,
): Promise<unknown> {
  return networkBookAppointment(payload, { confirm: true });
}
