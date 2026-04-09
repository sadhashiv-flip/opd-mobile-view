/** Session keys for the dental booking flow (network list → slots). */

export const DENTAL_SELECTED_CLINIC_KEY = "opd-mobile-view.dental.selectedClinic";

export const DENTAL_PREFERRED_DATETIME_KEY = "opd-mobile-view.dental.preferredDateTime";

export function readDentalSelectedClinicRaw(): string | null {
  try {
    const s = sessionStorage.getItem(DENTAL_SELECTED_CLINIC_KEY);
    return s?.trim() ? s : null;
  } catch {
    return null;
  }
}

export function writeDentalPreferredDateTime(iso: string): void {
  try {
    sessionStorage.setItem(DENTAL_PREFERRED_DATETIME_KEY, iso);
  } catch {
    // ignore
  }
}

export function readDentalPreferredDateTime(): string | null {
  try {
    const s = sessionStorage.getItem(DENTAL_PREFERRED_DATETIME_KEY);
    return s?.trim() ? s : null;
  } catch {
    return null;
  }
}
