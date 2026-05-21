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

/** patient_app `DentalRepository.bookDentalService` — invoice id for success / orders. */
export function parseDentalBookingInvoiceId(data: unknown): string {
  if (data == null || typeof data !== "object") return "";
  const root = data as Record<string, unknown>;
  let invoiceId = String(root.invoice_id ?? "").trim();
  const service = root.service;
  if (!invoiceId && service != null && typeof service === "object") {
    invoiceId = String((service as Record<string, unknown>).id ?? "").trim();
  }
  const inner = root.data;
  if (inner != null && typeof inner === "object") {
    const nested = inner as Record<string, unknown>;
    if (!invoiceId) {
      invoiceId = String(nested.invoice_id ?? nested.id ?? "").trim();
    }
  }
  return invoiceId;
}
