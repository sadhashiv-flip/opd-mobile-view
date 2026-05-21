import type { InvoiceDetailModel, LabSubOrderDetailRow } from "@/api/patientInvoices";

/** Vision / dental / vaccine — `ServiceRequestOrderDetailScreen` cancel sheet (not pharmacy). */
export const SERVICE_REQUEST_ORDER_CATEGORY_KEYS = ["vision", "dental", "vaccine"] as const;

export type ServiceRequestOrderCategoryKey = (typeof SERVICE_REQUEST_ORDER_CATEGORY_KEYS)[number];

export function isServiceRequestOrderCategory(
  categoryKey: string | null | undefined,
): categoryKey is ServiceRequestOrderCategoryKey {
  if (!categoryKey) return false;
  return (SERVICE_REQUEST_ORDER_CATEGORY_KEYS as readonly string[]).includes(categoryKey);
}

/** patient_app: pending / awaiting states that allow user-initiated cancel. */
export const ORDER_CANCEL_ALLOWED_STATUSES = [0, 3, 4] as const;

export function isOrderStatusCancelable(status: number | null | undefined): boolean {
  if (status == null || !Number.isFinite(status)) return false;
  return (ORDER_CANCEL_ALLOWED_STATUSES as readonly number[]).includes(status);
}

/**
 * Standard cancel CTA (excludes mental wellness / nutrition — use {@link InvoiceDetailModel.wellnessSessionCancelAllowed}).
 * Mirrors patient_app `canCancel` / `canCancelRequest` / `canCancelOrder` per order type.
 */
export function isStandardOrderCancelAllowed(detail: InvoiceDetailModel): boolean {
  const serviceId = detail.consultationInfoId?.trim();
  if (!serviceId) return false;

  if (detail.categoryKey === "mental_wellness" || detail.categoryKey === "nutrition") {
    return false;
  }

  if (detail.categoryKey === "lab") {
    if (detail.labSubOrders.length === 0) return false;
    return detail.labSubOrders.every((row: LabSubOrderDetailRow) =>
      isOrderStatusCancelable(row.status),
    );
  }

  if (detail.isConsultationOrder) {
    return isOrderStatusCancelable(detail.consultationInfoStatus);
  }

  return isOrderStatusCancelable(detail.serviceInfoStatus);
}

export type ConsultationAttachmentUiRules = Readonly<{
  /** patient_app `showAttachmentsBody` */
  sectionVisible: boolean;
  /** patient_app `canAddAttachment` */
  canAdd: boolean;
  /** patient_app `canDeleteAttachment` */
  canDelete: boolean;
}>;

/**
 * patient_app `ConsultationOrderDetailController` — ONLINE/OFFLINE → add at status 5 or 6;
 * other communication → add at status 5 only; delete at status 5 only.
 */
export function computeConsultationAttachmentUiRules(args: {
  readonly infoStatus: number | null;
  readonly placeTag: "virtual" | "in_person" | null;
  readonly attachmentCount: number;
}): ConsultationAttachmentUiRules {
  const st = args.infoStatus;
  const hasFiles = args.attachmentCount > 0;
  const isOnlineOrOffline = args.placeTag === "virtual" || args.placeTag === "in_person";

  if (st == null) {
    return { sectionVisible: hasFiles, canAdd: false, canDelete: false };
  }

  const sectionVisible = hasFiles || st === 5 || st === 6;
  const canAdd = isOnlineOrOffline ? st === 5 || st === 6 : st === 5;
  const canDelete = st === 5;

  return { sectionVisible, canAdd, canDelete };
}

/**
 * patient_app `ConsultationOrderDetailController.canJoinCall` / `Order.showsJoinCallOption`.
 * FLIPHEALTH online consultation, status 5, before slot end (+10 min).
 */
export function computeConsultationCanJoinCall(args: {
  readonly isConsultationOrder: boolean;
  readonly consultationPlaceTag: InvoiceDetailModel["consultationPlaceTag"];
  readonly consultationInfoStatus: number | null;
  readonly infoSource: string | null;
  readonly slotEndMs: number | null;
  readonly videoAppointmentId: string | null;
}): boolean {
  if (!args.isConsultationOrder) return false;
  if (args.consultationPlaceTag !== "virtual") return false;
  const source = (args.infoSource ?? "FLIPHEALTH").trim().toUpperCase();
  if (source !== "FLIPHEALTH") return false;
  if (args.consultationInfoStatus !== 5) return false;
  const appointmentId = args.videoAppointmentId?.trim();
  if (!appointmentId) return false;
  if (args.slotEndMs == null || Date.now() > args.slotEndMs) return false;
  return true;
}

/** patient_app `onJoinCallPressed` — join allowed within 2 minutes of scheduled start. */
export function isConsultationJoinCallWithinEarlyWindow(slotStartMs: number | null): boolean {
  if (slotStartMs == null || !Number.isFinite(slotStartMs)) return false;
  return (slotStartMs - Date.now()) / 60_000 <= 2;
}

/** patient_app `showOfflineReportsSection` — offline `info.reports` as “Prescriptions”, not a Reports tab. */
export function showOfflineConsultationPrescriptionsSection(detail: InvoiceDetailModel): boolean {
  return (
    detail.isConsultationOrder &&
    detail.consultationPlaceTag === "in_person" &&
    detail.consultationReports.length > 0
  );
}

/** patient_app `PharmacyOrderDetailController.showAttachmentsSection`. */
export function isPartnerOrderAttachmentsSectionVisible(args: {
  readonly infoStatus: number | null;
  readonly attachmentCount: number;
}): boolean {
  if (args.attachmentCount > 0) return true;
  return !isOrderStatusCancelable(args.infoStatus);
}
