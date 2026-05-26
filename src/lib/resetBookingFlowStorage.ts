import {
  CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY,
  writeConsultSelectedPersonIds,
} from "@/constants/consultationSelectedMemberStorage";
import { clearDentalBookingFlowState } from "@/constants/dentalBookingStorage";
import { clearDiagnosticsHealthFlowStorage } from "@/constants/diagnosticsHealthFlowStorage";
import {
  clearLabSlotPayload,
  clearLabVendorSelection,
} from "@/constants/diagnosticsLabFlowStorage";
import {
  DIAG_SELECTED_MEMBER_SNAPSHOT_KEY,
  writeDiagnosticsSelectedPersonIds,
} from "@/constants/diagnosticsSelectedMemberStorage";
import {
  clearGymFlowV2Draft,
  clearGymFlowV2LineForms,
  clearGymFlowV2Overview,
} from "@/constants/gymFlowV2Storage";
import { clearGymSelectedMemberSnapshot } from "@/constants/gymSelectedMemberStorage";
import { clearPharmacyFlipRxSelection } from "@/constants/pharmacyFlipRxSelectionStorage";
import { clearPharmacyFlowState } from "@/constants/pharmacyFlowStorage";
import { clearPharmacyReviewDraft } from "@/constants/pharmacyReviewDraft";
import { clearSelectPeoplePickerDraft } from "@/constants/selectPeoplePickerStorage";
import { clearVaccinationFlowState } from "@/constants/vaccinationFlowStorage";
import { clearVisionBookingFlowState } from "@/constants/visionBookingStorage";
import {
  clearVirtualConsultPurposeAndLanguage,
  clearVirtualFollowUpAppointmentId,
} from "@/constants/virtualConsultationSessionStorage";

const BOOKING_LOCAL_PREFIXES = [
  "opd-mobile-view.consultation.",
  "opd-mobile-view.diagnostics.",
  "opd-mobile-view.atHospital.",
  "opd-mobile-view.gym-membership.",
  "opd-mobile-view.health-checkups.",
] as const;

const BOOKING_SESSION_PREFIXES = [
  "opd-mobile-view.consultation.",
  "opd-mobile-view.diagnostics.",
  "opd-mobile-view.selectPeople.",
  "opd-mobile-view.dental.",
  "opd-mobile-view.vision.",
  "opd-mobile-view.vaccination.",
  "opd-mobile-view.pharmacy.",
  "opd-mobile-view.virtualBooking.",
  "opd-mobile-view.virtualSlots.",
  "opd-mobile-view.gym-flow-v2.",
  "opd-mobile-view.gym-membership.",
  "opd-mobile-view.health-checkups.",
  "opd-mobile-view.fitness.",
] as const;

function removeStorageKeysByPrefixes(
  storage: Storage,
  prefixes: readonly string[],
): void {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (prefixes.some((p) => key.startsWith(p))) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

/**
 * Clears in-progress booking / picker drafts when the user lands on the home dashboard.
 * Does not touch auth, profile cache, or the saved delivery address.
 */
export function resetBookingFlowStorageOnDashboard(): void {
  try {
    clearLabSlotPayload();
    clearLabVendorSelection();
    clearDiagnosticsHealthFlowStorage();

    writeConsultSelectedPersonIds([]);
    writeDiagnosticsSelectedPersonIds([]);
    clearSelectPeoplePickerDraft();

    try {
      sessionStorage.removeItem(CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY);
      sessionStorage.removeItem(DIAG_SELECTED_MEMBER_SNAPSHOT_KEY);
    } catch {
      // ignore
    }

    clearDentalBookingFlowState();
    clearVisionBookingFlowState();
    clearVaccinationFlowState();

    clearPharmacyFlipRxSelection();
    clearPharmacyFlowState();
    clearPharmacyReviewDraft();

    clearVirtualConsultPurposeAndLanguage();
    clearVirtualFollowUpAppointmentId();

    clearGymFlowV2Draft();
    clearGymFlowV2Overview();
    clearGymFlowV2LineForms();
    clearGymSelectedMemberSnapshot();

    removeStorageKeysByPrefixes(localStorage, BOOKING_LOCAL_PREFIXES);
    removeStorageKeysByPrefixes(sessionStorage, BOOKING_SESSION_PREFIXES);
  } catch {
    // ignore quota / private mode
  }
}
