/** Purpose textarea on virtual consultation overview — seeded from follow-up entry. */
export const VIRTUAL_CONSULT_PURPOSE_KEY = "opd-mobile-view.virtualBooking.purpose";

/** Preferred language on virtual consultation overview. */
export const VIRTUAL_CONSULT_LANGUAGE_KEY = "opd-mobile-view.virtualBooking.language";

/**
 * When set, `POST /appointment/book` includes `appointment_id` (prior completed appointment)
 * for follow-up booking from order details.
 */
export const VIRTUAL_CONSULT_FOLLOW_UP_APPOINTMENT_ID_KEY =
  "opd-mobile-view.virtualBooking.followUpAppointmentId";

export function writeVirtualFollowUpAppointmentId(id: string | null | undefined): void {
  try {
    const t = id?.trim();
    if (!t) {
      sessionStorage.removeItem(VIRTUAL_CONSULT_FOLLOW_UP_APPOINTMENT_ID_KEY);
    } else {
      sessionStorage.setItem(VIRTUAL_CONSULT_FOLLOW_UP_APPOINTMENT_ID_KEY, t);
    }
  } catch {
    // ignore
  }
}

export function readVirtualFollowUpAppointmentId(): string | null {
  try {
    const v = sessionStorage.getItem(VIRTUAL_CONSULT_FOLLOW_UP_APPOINTMENT_ID_KEY);
    return v?.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearVirtualFollowUpAppointmentId(): void {
  writeVirtualFollowUpAppointmentId(null);
}

/** Clears overview form seeds — use when starting a new virtual booking (not follow-up). */
export function clearVirtualConsultPurposeAndLanguage(): void {
  try {
    sessionStorage.removeItem(VIRTUAL_CONSULT_PURPOSE_KEY);
    sessionStorage.removeItem(VIRTUAL_CONSULT_LANGUAGE_KEY);
  } catch {
    // ignore
  }
}
