/** URL slug → `GET /patient/history/type/{apiSegment}` (matches Flutter `MedicalRecordsRepository`). */

export type MedicalRecordCategoryDef = Readonly<{

  slug: string;

  apiSegment: string;

  label: string;

  description: string;

}>;



export const DEFAULT_MEDICAL_RECORD_SLUG = "consultations";



export const HEALTH_LOG_GROUP_LABEL = "Health log";



/** Bookings & clinical services — matches Flutter `MedicalRecordsCategories.primary`. */

export const MEDICAL_RECORD_PRIMARY_CATEGORIES: readonly MedicalRecordCategoryDef[] = [

  { slug: "consultations", apiSegment: "consultations", label: "Consultations", description: "Past and upcoming visits" },

  { slug: "lab-tests", apiSegment: "labtest", label: "Lab Tests", description: "Diagnostics and reports" },

  { slug: "prescriptions", apiSegment: "prescriptions", label: "Prescriptions", description: "Medicines from doctors" },

  { slug: "mental-wellness", apiSegment: "mentalwellness", label: "Mental Wellness", description: "Wellness sessions" },

  { slug: "nutrition", apiSegment: "nutrition", label: "Nutrition", description: "Nutrition sessions" },

  { slug: "dental", apiSegment: "dental", label: "Dental", description: "Dental services" },

  { slug: "vision", apiSegment: "vision", label: "Vision", description: "Vision services" },

  { slug: "vaccine", apiSegment: "vaccine", label: "Vaccine", description: "Vaccination records" },

];



/** Diary-style entries — matches Flutter `MedicalRecordsCategories.healthLogSubs`. */

export const MEDICAL_RECORD_HEALTH_LOG_CATEGORIES: readonly MedicalRecordCategoryDef[] = [

  { slug: "vitals", apiSegment: "vitals", label: "Vitals", description: "Heart rate, BP, and more" },

  { slug: "symptoms", apiSegment: "symptoms", label: "Symptoms", description: "Recorded symptoms" },

  { slug: "medicines", apiSegment: "medicines", label: "Medicines", description: "Medicine history" },

  { slug: "moods", apiSegment: "moods", label: "Moods", description: "Mood entries" },

  { slug: "measurements", apiSegment: "measurements", label: "Measurements", description: "Body measurements" },

  { slug: "womens", apiSegment: "womens", label: "Women's", description: "Women's health records" },

  { slug: "conditions", apiSegment: "conditions", label: "Conditions", description: "Diagnosed conditions" },

];



export const MEDICAL_RECORD_CATEGORIES: readonly MedicalRecordCategoryDef[] = [

  ...MEDICAL_RECORD_PRIMARY_CATEGORIES,

  ...MEDICAL_RECORD_HEALTH_LOG_CATEGORIES,

];



const bySlug = new Map(MEDICAL_RECORD_CATEGORIES.map((c) => [c.slug, c]));



export function medicalRecordCategoryFromSlug(slug: string | undefined): MedicalRecordCategoryDef | null {

  if (!slug?.trim()) return null;

  return bySlug.get(slug.trim()) ?? null;

}



export function isHealthLogMedicalRecordSlug(slug: string): boolean {

  return MEDICAL_RECORD_HEALTH_LOG_CATEGORIES.some((c) => c.slug === slug);

}



export function isDefaultMedicalRecordCategory(category: MedicalRecordCategoryDef | null): boolean {

  return category?.slug === DEFAULT_MEDICAL_RECORD_SLUG;

}



/** Short label for the active filter chip — mirrors Flutter `activeFilterLabel`. */

export function activeMedicalRecordFilterLabel(category: MedicalRecordCategoryDef): string {

  if (isHealthLogMedicalRecordSlug(category.slug)) {

    return `${HEALTH_LOG_GROUP_LABEL} · ${category.label}`;

  }

  return category.label;

}


