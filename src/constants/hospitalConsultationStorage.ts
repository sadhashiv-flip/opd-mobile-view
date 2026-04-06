const SPECIALTY_NAME_PREFIX = "opd-mobile-view.atHospital.specialtyName";

/** Remember display name when navigating from specialties list (numeric `specialtyId` in URL). */
export function rememberHospitalSpecialtyName(specialtyId: string, name: string): void {
  try {
    sessionStorage.setItem(`${SPECIALTY_NAME_PREFIX}.${specialtyId}`, name.trim());
  } catch {
    // ignore
  }
}

export function readHospitalSpecialtyName(specialtyId: string): string | null {
  try {
    const v = sessionStorage.getItem(`${SPECIALTY_NAME_PREFIX}.${specialtyId}`)?.trim();
    return v || null;
  } catch {
    return null;
  }
}
