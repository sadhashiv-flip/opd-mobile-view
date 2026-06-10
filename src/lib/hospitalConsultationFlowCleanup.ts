import {
  clearHospitalVendorBookingContext,
  HOSPITAL_SELECTED_SPECIALTY_ID_KEY,
} from "@/constants/consultationBookingStorage";
import {
  CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY,
  CONSULT_SELECTED_PERSON_IDS_KEY,
  CONSULT_SELECTED_PERSON_KEY,
} from "@/constants/consultationSelectedMemberStorage";
import { writeNetworkDoctorDetailEntry } from "@/constants/networkDoctorDetailStorage";

const CONSULTATION_LOCAL_PREFIX = "opd-mobile-view.consultation.";
const CONSULTATION_SESSION_PREFIX = "opd-mobile-view.consultation.";

const SLOT_PICK_LOCAL_KEYS = [
  "opd-mobile-view.consultation.slotId",
  "opd-mobile-view.consultation.vendorSlotId",
  "opd-mobile-view.consultation.slotLabel",
  "opd-mobile-view.consultation.dayLabel",
  "opd-mobile-view.consultation.timeSlot",
] as const;

function removeStorageKeysWithPrefix(
  storage: Storage,
  prefix: string,
  except: ReadonlySet<string> = new Set(),
): void {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    if (except.has(key)) continue;
    toRemove.push(key);
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

/** Clears transient slot selection keys (localStorage). */
export function clearHospitalConsultationSlotPicks(): void {
  try {
    for (const key of SLOT_PICK_LOCAL_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * Clears in-progress at-hospital vendor booking state when leaving the doctor list
 * back to specialties (or restarting the flow).
 */
export function clearHospitalConsultationBookingState(): void {
  clearHospitalVendorBookingContext();
  writeNetworkDoctorDetailEntry(null);
  /** Member picked on select-people must survive backing out of doctor/slots steps. */
  const keepLocal = new Set<string>([
    CONSULT_SELECTED_PERSON_KEY,
    CONSULT_SELECTED_PERSON_IDS_KEY,
  ]);
  const keepSession = new Set<string>([
    HOSPITAL_SELECTED_SPECIALTY_ID_KEY,
    CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY,
  ]);
  try {
    removeStorageKeysWithPrefix(localStorage, CONSULTATION_LOCAL_PREFIX, keepLocal);
    removeStorageKeysWithPrefix(sessionStorage, CONSULTATION_SESSION_PREFIX, keepSession);
  } catch {
    // ignore
  }
}
