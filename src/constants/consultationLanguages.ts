import { readCachedProfileLanguage } from "@/api/patientProfile";

/**
 * Allowed consultation languages for virtual flow (`availableSlots?language=` + booking).
 * Swap {@link languageList} for an API-driven array when the backend provides options.
 */
export const languageList: readonly string[] = [
  "Telugu",
  "Hindi",
  "English",
  "Tamil",
  "Kannada",
  "Marathi",
  "Malayalam",
  "Gujarati",
];

/** Picker rows — value and label match API tokens. */
export const CONSULTATION_LANGUAGES: readonly { value: string; label: string }[] =
  languageList.map((lang) => ({ value: lang, label: lang }));

export function isConsultationLanguageValue(v: string): boolean {
  return languageList.includes(v);
}

/** Maps profile / member language strings to a supported consultation language token. */
export function normalizeConsultationLanguage(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (languageList.includes(t)) return t;
  const lower = t.toLowerCase();
  const match = languageList.find((lang) => lang.toLowerCase() === lower);
  return match ?? null;
}

/**
 * Default virtual consultation language — patient_app `ConsultationController.onInit`
 * (`selectedLanguage` from saved user profile, else English).
 */
export function resolveDefaultConsultationLanguage(opts?: Readonly<{
  memberLanguage?: string | null;
  sessionLanguage?: string | null;
}>): string {
  const fromSession = normalizeConsultationLanguage(opts?.sessionLanguage);
  if (fromSession) return fromSession;
  const fromMember = normalizeConsultationLanguage(opts?.memberLanguage);
  if (fromMember) return fromMember;
  const fromProfile = normalizeConsultationLanguage(readCachedProfileLanguage());
  if (fromProfile) return fromProfile;
  return "English";
}
