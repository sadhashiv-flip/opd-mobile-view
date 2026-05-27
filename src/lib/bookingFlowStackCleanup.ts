import {
  DIAG_HEALTH_USERS_PACKAGES_KEY,
  DIAG_HEALTH_VENDOR_DRAFT_KEY,
  DIAG_HEALTH_VENDOR_META_KEY,
  clearHealthSlotPicks,
  writeHealthPackageDraft,
} from "@/constants/diagnosticsHealthFlowStorage";
import {
  clearLabSlotPayload,
  clearLabVendorSelection,
} from "@/constants/diagnosticsLabFlowStorage";
import { clearPharmacyFlipRxSelection } from "@/constants/pharmacyFlipRxSelectionStorage";
import { clearPharmacyReviewDraft } from "@/constants/pharmacyReviewDraft";
import {
  clearHospitalConsultationBookingState,
  clearHospitalConsultationSlotPicks,
} from "@/lib/hospitalConsultationFlowCleanup";

export {
  clearHospitalConsultationBookingState,
  clearHospitalConsultationSlotPicks,
} from "@/lib/hospitalConsultationFlowCleanup";

/** Step 3+ in lab flow (slots, overview). */
export function clearLabSlotStep(): void {
  clearLabSlotPayload();
}

/** Step 2+ in lab flow (vendor, slots, overview). */
export function clearLabVendorAndDownstream(): void {
  clearLabVendorSelection();
  clearLabSlotPayload();
}

/** Step 4+ in health checkup flow (overview reads slots — no extra keys). */
export function clearHealthSlotStep(): void {
  clearHealthSlotPicks();
}

/** Vendor step only — pathology/radiology picks + slot picks (plan / select-people data kept). */
export function clearHealthVendorStep(): void {
  clearHealthSlotPicks();
  try {
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_VENDOR_META_KEY);
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_VENDOR_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Step 3+ in health checkup flow (vendor picks + slots). */
export function clearHealthVendorAndDownstream(): void {
  clearHealthVendorStep();
}

/** Step 2+ in health checkup flow (plan packages + later steps). */
export function clearHealthPlanAndDownstream(): void {
  writeHealthPackageDraft({});
  try {
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_USERS_PACKAGES_KEY);
  } catch {
    // ignore
  }
  clearHealthVendorAndDownstream();
}

export function clearDiagnosticsDownstreamFromPlan(type: string): void {
  if (type === "lab-tests") {
    clearLabVendorAndDownstream();
    return;
  }
  if (type === "health-checkups") {
    clearHealthPlanAndDownstream();
  }
}

export function clearDiagnosticsDownstreamFromSelectPeople(type: string): void {
  clearDiagnosticsDownstreamFromPlan(type);
}

/** Leaving prescription picker (exits flow or goes to hub). */
export function clearPharmacyDownstreamFromPrescriptionSelect(): void {
  clearPharmacyReviewDraft();
  clearPharmacyFlipRxSelection();
}

/** Back from order review → prescription list (keep RX picks, drop review draft). */
export function clearPharmacyReviewStep(): void {
  clearPharmacyReviewDraft();
}

/** Back from overview → slots (keep doctor/network context). */
export function clearHospitalConsultationOverviewStep(): void {
  clearHospitalConsultationSlotPicks();
}

/** Back from doctor list → specialties. */
export function clearHospitalConsultationResultsStep(): void {
  clearHospitalConsultationBookingState();
}
