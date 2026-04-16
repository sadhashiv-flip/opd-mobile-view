import { patientJson } from "@/api/patientHttp";

/** `center.address` for {@link DentalServiceRequestPayload} — matches patient-app dental booking. */
export type DentalServiceCenterAddressPayload = Readonly<{
  line_1: string;
  city: string;
  pincode: string;
}>;

export type DentalServiceCenterPayload = Readonly<{
  name: string;
  phone: string;
  address: DentalServiceCenterAddressPayload;
}>;

/** POST `/service/dental/request` body (parity with `flip_health` `DentalRepository.bookDentalService`). */
export type DentalServiceRequestPayload = Readonly<{
  address_id: string;
  preferred_date_time: string;
  alternate_phone: string;
  conditions: string;
  note: string;
  language: string;
  provider_id: string;
  clinic_id: string;
  user_id: number;
  center: DentalServiceCenterPayload;
}>;

/** POST `/service/dental/request` */
export async function postDentalServiceRequest(payload: DentalServiceRequestPayload): Promise<unknown> {
  return patientJson<unknown>("service/dental/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
