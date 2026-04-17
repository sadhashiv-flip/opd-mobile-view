/** URL slug → `GET /patient/history/type/{apiSegment}` (matches Flutter `MedicalRecordsRepository`). */
export type MedicalRecordCategoryDef = Readonly<{
  slug: string;
  apiSegment: string;
  label: string;
  description: string;
}>;

export const MEDICAL_RECORD_CATEGORIES: readonly MedicalRecordCategoryDef[] = [
  { slug: "consultations", apiSegment: "consultations", label: "Consultations", description: "Past and upcoming visits" },
  { slug: "lab-tests", apiSegment: "labtest", label: "Lab tests", description: "Diagnostics and reports" },
  { slug: "prescriptions", apiSegment: "prescriptions", label: "Prescriptions", description: "Medicines from doctors" },
  { slug: "vitals", apiSegment: "vitals", label: "Vitals", description: "Heart rate, BP, and more" },
  { slug: "symptoms", apiSegment: "symptoms", label: "Symptoms", description: "Recorded symptoms" },
  { slug: "medicines", apiSegment: "medicines", label: "Medicines", description: "Medicine history" },
  { slug: "moods", apiSegment: "moods", label: "Moods", description: "Mood entries" },
  { slug: "measurements", apiSegment: "measurements", label: "Measurements", description: "Body measurements" },
  { slug: "womens", apiSegment: "womens", label: "Women's health", description: "Women's health records" },
  { slug: "conditions", apiSegment: "conditions", label: "Conditions", description: "Diagnosed conditions" },
  { slug: "mental-wellness", apiSegment: "mentalwellness", label: "Mental wellness", description: "Wellness requests" },
  { slug: "nutrition", apiSegment: "nutrition", label: "Nutrition", description: "Nutrition sessions" },
];

const bySlug = new Map(MEDICAL_RECORD_CATEGORIES.map((c) => [c.slug, c]));

export function medicalRecordCategoryFromSlug(slug: string | undefined): MedicalRecordCategoryDef | null {
  if (!slug?.trim()) return null;
  return bySlug.get(slug.trim()) ?? null;
}
