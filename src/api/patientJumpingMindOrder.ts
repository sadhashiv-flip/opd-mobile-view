import { patientFetchChecked } from "@/api/patientHttp";

/** `PATCH /patient/jumping-mind/expert/order/cancel` — Trijog / mental wellness & nutrition orders. */
export async function patchJumpingMindOrderCancel(body: Readonly<{
  service_id: string;
  cancellation_reason: string;
}>): Promise<void> {
  await patientFetchChecked("jumping-mind/expert/order/cancel", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
