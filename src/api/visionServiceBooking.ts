import { patientJson } from "@/api/patientHttp";

export type VisionBookingSlotPayload = Readonly<{
  slot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
}>;

export type VisionPrescriptionRef = Readonly<{ id: string }>;

export type VisionServiceRequestPayload = Readonly<{
  booking_type: "clinic" | "store";
  user_id: number;
  network_id: string;
  address_id: string;
  slot: VisionBookingSlotPayload;
  /** Required when `booking_type` is `"store"` (glasses/lens) — upload attachment ids from `/upload`. */
  prescription?: readonly VisionPrescriptionRef[];
}>;

/** POST `/service/vision/request` */
export async function postVisionServiceRequest(
  payload: VisionServiceRequestPayload,
): Promise<unknown> {
  return patientJson<unknown>("service/vision/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
