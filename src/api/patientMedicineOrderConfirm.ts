import { patientJson } from "@/api/patientHttp";

/** Partner / patient confirms pharmacy order details — advances `info.status` (e.g. 3 → 4). `PM…` medicine order ids. */
export async function patchMedicineOrderConfirm(medicineOrderId: string): Promise<unknown> {
  const id = encodeURIComponent(medicineOrderId.trim());
  return patientJson<unknown>(`medicine/order/confirm/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: 4 }),
    skipGlobalLoading: true,
  });
}

/**
 * `PATCH medicine/order/cancel/:medicine_order_id` — patient_app `PharmacyRepository.cancelMedicineOrder`.
 * `medicine_order_id` is invoice `info.id` (`PM…`), not the document invoice id.
 */
export async function patchMedicineOrderCancel(
  medicineOrderId: string,
  cancellationReason: string,
): Promise<unknown> {
  const id = medicineOrderId.trim();
  if (!id) {
    throw new Error("Missing medicine order id");
  }
  const note = cancellationReason.trim();
  return patientJson<unknown>(`medicine/order/cancel/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ cancellation_reason: note }),
    skipGlobalLoading: true,
  });
}
