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
