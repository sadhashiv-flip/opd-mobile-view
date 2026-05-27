import type { InvoiceDetailModel } from "@/api/patientInvoices";
import { isSameCalendarDayMs } from "@/utils/vendorConsultationSlots";

export type ConsultationStatusBannerTone =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral";

/** patient_app `_consultationStatusStyle` + service-request tone mapping. */
export function consultationStatusBannerTone(
  detail: InvoiceDetailModel,
  slotExpired = false,
): ConsultationStatusBannerTone {
  const st = detail.consultationInfoStatus ?? -1;
  const source = (detail.consultationInfoSource ?? "FLIPHEALTH").trim().toUpperCase();

  if (st === 0 && source === "FLIPHEALTH" && detail.consultationSlotStartMs != null) {
    const threshold = detail.consultationSlotStartMs + 10 * 60 * 1000;
    if (Date.now() > threshold) return "error";
    return "info";
  }

  if (st === 1 || st === 6) return "success";
  if (st === 2 || st === 9 || slotExpired) return "error";
  if (st === 4) return "warning";
  if (st === 5 || st === 0 || st === 3) return "info";
  return "neutral";
}

export function consultationDetailStatusLabel(detail: InvoiceDetailModel): string {
  return detail.consultationDetailStatusLabel ?? detail.bannerTitle;
}

/** patient_app `ConsultationOrderDetailController.showInvoiceSection`. */
export function showConsultationInvoiceSection(
  infoStatus: number | null,
  lineItemCount: number,
): boolean {
  if (infoStatus === 0) return false;
  return lineItemCount > 0;
}

function isFlipHealthSource(detail: InvoiceDetailModel): boolean {
  return (detail.consultationInfoSource ?? "FLIPHEALTH").trim().toUpperCase() === "FLIPHEALTH";
}

/** patient_app `showClinicalNotesSection`. */
export function showConsultationClinicalNotesSection(detail: InvoiceDetailModel): boolean {
  return detail.showConsultationClinicalNotes === true;
}

/** patient_app `showOfflineRescheduleSection`. */
export function showConsultationOfflineRescheduleSection(detail: InvoiceDetailModel): boolean {
  if (!detail.isConsultationOrder || isFlipHealthSource(detail)) return false;
  if (detail.consultationInfoStatus !== 3) return false;
  return detail.consultationOfflineReschedule != null;
}

/** patient_app `showNetworkPrescriptionsSection`. */
export function showConsultationNetworkPrescriptionsSection(detail: InvoiceDetailModel): boolean {
  if (!detail.isConsultationOrder || isFlipHealthSource(detail)) return false;
  return detail.consultationNetworkPrescriptionUrls.length > 0;
}

/** patient_app `showFlipPrescriptionSection`. */
export function showConsultationFlipPrescriptionSection(detail: InvoiceDetailModel): boolean {
  if (!detail.isConsultationOrder || !isFlipHealthSource(detail)) return false;
  if (detail.consultationInfoStatus !== 1) return false;
  return Boolean(detail.consultationInfoId?.trim());
}

/** patient_app `showScanQrButton` — offline, Practo, status 5, same-day slot. */
export function showConsultationScanQrButton(detail: InvoiceDetailModel): boolean {
  return (
    detail.isConsultationOrder &&
    detail.consultationPlaceTag === "inPerson" &&
    detail.consultationVendorCode.trim().toLowerCase() === "practo" &&
    detail.consultationInfoStatus === 5 &&
    isSameCalendarDayMs(detail.consultationScheduledStartMs)
  );
}

/** patient_app `showRescheduleButton` (offline vendor, status 4|5, ≥2h before slot). */
export function showConsultationRescheduleButton(detail: InvoiceDetailModel): boolean {
  if (!detail.isConsultationOrder || detail.consultationPlaceTag !== "inPerson") return false;
  if (isFlipHealthSource(detail)) return false;
  if (!detail.consultationVendorRescheduleContext) return false;
  const st = detail.consultationInfoStatus;
  if (st !== 4 && st !== 5) return false;
  const startMs = detail.consultationScheduledStartMs;
  if (startMs == null) return false;
  const now = Date.now();
  if (now >= startMs) return false;
  const cutoff = startMs - 2 * 60 * 60 * 1000;
  return now <= cutoff;
}
