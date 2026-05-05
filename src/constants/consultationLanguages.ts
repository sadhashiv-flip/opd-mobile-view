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
