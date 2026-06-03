/** patient-app `WellnessOrderDetailController.statusLabel` + banner tones. */

export function wellnessOrderStatusLabel(
  infoStatus: number | null | undefined,
  categoryKey: string,
): string {
  const n = infoStatus == null || !Number.isFinite(infoStatus) ? -1 : Math.trunc(infoStatus);
  if (n === 5) {
    return categoryKey === "mental_wellness" ? "Upcoming session" : "Booking confirmed";
  }
  switch (n) {
    case 0:
      return "Waiting for confirmation";
    case 1:
      return "Completed";
    case 2:
      return "Cancelled";
    case 3:
      return "Confirm changes";
    case 4:
      return "Payment pending";
    case 9:
      return "Expired";
    default:
      return "Waiting for confirmation";
  }
}

export type WellnessStatusBannerTone = "success" | "error" | "warning" | "info" | "neutral";

export function wellnessStatusBannerTone(infoStatus: number | null | undefined): WellnessStatusBannerTone {
  const n = infoStatus == null || !Number.isFinite(infoStatus) ? -1 : Math.trunc(infoStatus);
  if (n === 1 || n === 6) return "success";
  if (n === 2 || n === 9) return "error";
  if (n === 4) return "warning";
  if (n === 5 || n === 0 || n === 3) return "info";
  return "neutral";
}

/** Maps wellness `info.status` to orders list / detail banner tone. */
export function wellnessInfoStatusToListTone(
  infoStatus: number | null | undefined,
): "completed" | "cancelled" | "paymentPending" | "upcoming" | "processing" | "confirmPending" {
  const n = infoStatus == null || !Number.isFinite(infoStatus) ? -1 : Math.trunc(infoStatus);
  if (n === 1 || n === 6) return "completed";
  if (n === 2 || n === 9) return "cancelled";
  if (n === 4) return "paymentPending";
  if (n === 5) return "upcoming";
  if (n === 3) return "confirmPending";
  if (n === 0) return "processing";
  return "processing";
}
