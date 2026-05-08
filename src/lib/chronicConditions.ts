export type ChronicConditionId =
  | "Diabetes"
  | "CoronaryArtery"
  | "Hypertension"
  | "Thyroid";

export type ChronicConditionMeta = Readonly<{
  id: ChronicConditionId;
  title: string;
  shortDescription: string;
}>;

export const CHRONIC_PROGRAMS: readonly ChronicConditionMeta[] = [
  {
    id: "Diabetes",
    title: "Diabetes Management Type 2",
    shortDescription: "Worried about sugar? Manage it better with us.",
  },
  {
    id: "CoronaryArtery",
    title: "Coronary Artery Management",
    shortDescription: "Your heart is in good hands with guided lifestyle tracking.",
  },
  {
    id: "Hypertension",
    title: "Hypertension Management",
    shortDescription: "Keep blood pressure under control with structured follow-up.",
  },
  {
    id: "Thyroid",
    title: "Thyroid Management",
    shortDescription: "Struggling with thyroid? Manage it better with us.",
  },
];

export function isChronicConditionId(value: string): value is ChronicConditionId {
  return CHRONIC_PROGRAMS.some((program) => program.id === value);
}

export function chronicConditionMetaById(
  conditionId: string,
): ChronicConditionMeta | null {
  return CHRONIC_PROGRAMS.find((program) => program.id === conditionId) ?? null;
}

export type ChronicProfileSection = Readonly<{
  key: "symptom" | "medicine" | "notes";
  title: string;
  categoryApiValue: "symptom" | "medicine" | "notes";
}>;

export const CHRONIC_PROFILE_SECTIONS: readonly ChronicProfileSection[] = [
  { key: "symptom", title: "Symptoms", categoryApiValue: "symptom" },
  { key: "medicine", title: "Medicines", categoryApiValue: "medicine" },
  { key: "notes", title: "Notes", categoryApiValue: "notes" },
];

export type ChronicParameterType = Readonly<{
  key: "temperature" | "spo2" | "heart_rate" | "bp" | "glucose";
  apiType: "TEMP" | "O2" | "HR" | "BP" | "GL";
  label: string;
  units: string;
}>;

export const CHRONIC_PARAMETER_TYPES: readonly ChronicParameterType[] = [
  { key: "temperature", apiType: "TEMP", label: "Temperature", units: "F" },
  { key: "spo2", apiType: "O2", label: "SpO2", units: "%" },
  { key: "heart_rate", apiType: "HR", label: "Heart Rate", units: "bpm" },
  { key: "bp", apiType: "BP", label: "Blood Pressure", units: "mmHg" },
  { key: "glucose", apiType: "GL", label: "Glucose", units: "mg/dL" },
];

export const CHRONIC_ENROLLMENT_BENEFITS: readonly string[] = [
  "Personalized diet charts",
  "Personalized fitness regime",
  "Wellness webinars",
  "Frequent vital checkups",
  "Blogs and newsletters",
  "Progress charts",
];

export const CHRONIC_ENROLLMENT_JOURNEY: readonly string[] = [
  "Bring your chronic conditions under control",
  "Counseling sessions with wellness experts",
  "Workshops focused on lifestyle modification",
  "Regular monitoring and unlimited follow up",
  "Get personalized diet charts and fitness routines",
  "Discuss goals with your assigned doctor",
  "Take a full-body evaluation for in-depth analysis",
];

export type ChronicDietGuideSection = Readonly<{
  title: string;
  details: readonly string[];
}>;

export const CHRONIC_DIABETES_DIET_GUIDE: readonly ChronicDietGuideSection[] = [
  {
    title: "FOOD RECOMMENDATION",
    details: [
      "Follow small, frequent meals and reduce portion size. Prefer whole grains, oats, ragi and unpolished rice.",
      "Suggested fruits: apple, papaya, orange, mosambi, pineapple, guava, watermelon, pomegranate (100g/day).",
      "Daily usage of raw garlic, onion and methi is recommended. Restrict oil consumption to 3-4 tsp/day.",
      "Take plenty of oral liquids like water, around 3-4 litres/day.",
      "Low salt diet can help reduce BP risk.",
    ],
  },
  {
    title: "FOODS TO BE USED IN MODERATION",
    details: [
      "Limit root and tubers like potato, yam and colocasia.",
      "Tender coconut water can be taken in limited quantity.",
      "Prefer cut fruits instead of fruit juices to improve fiber intake.",
      "Limit high-sugar fruits like mango, sapota, custard apple, grapes and banana.",
    ],
  },
  {
    title: "FOODS TO BE AVOIDED",
    details: [
      "Avoid processed foods like white bread, pasta, noodles and maida-based bakery products.",
      "Avoid sugar, sweets, ice creams, chocolates, cakes and pastries.",
      "Avoid cream, butter, ghee and vanaspati.",
      "Avoid sugary beverages and proprietary drinks.",
      "Avoid red meat, organ meat and shellfish.",
    ],
  },
  {
    title: "DIETARY TIPS",
    details: [
      "About 5g methi seeds per day may help reduce blood sugar levels.",
      "Curry leaf powder can be added to curries daily.",
      "Regular intake of fibre-rich vegetables, whole grains and legumes is beneficial.",
    ],
  },
  {
    title: "EXERCISE",
    details: [
      "Regular exercise (35-45 min walk) is recommended as advised by your physiotherapist.",
      "Try post-meal walks and strength-training sessions on nonconsecutive days.",
      "Drink enough water and avoid sedentary behavior.",
      "Quit smoking and work on weight reduction if overweight.",
    ],
  },
];

export const CHRONIC_NUTRITION_PLAN_KEYS: readonly string[] = [
  "early-morning",
  "breakfast",
  "mid-morning",
  "lunch",
  "evening-snack",
  "dinner",
  "bed_side",
  "notice",
];
