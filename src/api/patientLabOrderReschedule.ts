import { readPatientApiError } from "@/api/patientClient";
import { patientFetch } from "@/api/patientHttp";
import type { DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";

export type LabOrderRescheduleBody = Readonly<{
  reschedule_reason: string;
  collection_date: string;
  start_time: string;
  end_time: string;
  slot_id: string;
  address_id: string;
}>;

function bodyFromSlot(reason: string, slot: DiagnosticSlotPick, addressId: string): LabOrderRescheduleBody {
  return {
    reschedule_reason: reason.trim(),
    collection_date: slot.slot_date.trim(),
    start_time: slot.start_time.trim(),
    end_time: slot.end_time.trim(),
    slot_id: slot.slot_id.trim(),
    address_id: addressId.trim(),
  };
}

/**
 * `PATCH {apiUrl}/lab/order/reschedule/:subOrderId` — reschedule a lab collection sub-order
 * (parity with Flutter `LabOrderDetailRepository.rescheduleLabSubOrder`).
 */
export async function patchLabOrderReschedule(
  subOrderId: string,
  payload: Readonly<{ reason: string; slot: DiagnosticSlotPick; addressId: string }>,
): Promise<void> {
  const sid = subOrderId.trim();
  if (!sid) {
    throw new Error("Missing booking id");
  }
  const body = bodyFromSlot(payload.reason, payload.slot, payload.addressId);
  const res = await patientFetch(`lab/order/reschedule/${encodeURIComponent(sid)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    skipGlobalLoading: true,
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  if (!text.trim()) return;
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const root = raw as Record<string, unknown>;
    if (root.status === false) {
      throw new Error(typeof root.message === "string" ? root.message : "Reschedule failed");
    }
  }
}
