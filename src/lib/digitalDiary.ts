import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";

/**
 * Digital diary (patient parameters) — mirrors Flutter `patient_app`
 * `activity_type_labels.dart`, `activity_submit_payloads.dart`, and category mapping
 * from `activities_repository.dart`.
 */

export const DIGITAL_DIARY_ACTIVITY_TYPES = [
  "water",
  "workout",
  "GL",
  "BP",
  "TEMP",
  "O2",
  "HR",
  "height",
  "weight",
  "sleep",
  "symptom",
  "mood",
  "medicine",
] as const;

export type DigitalDiaryActivityType = (typeof DIGITAL_DIARY_ACTIVITY_TYPES)[number];

const SUBMIT_SUPPORTED = new Set<string>(DIGITAL_DIARY_ACTIVITY_TYPES);

export function isDigitalDiaryActivityType(s: string): s is DigitalDiaryActivityType {
  return (DIGITAL_DIARY_ACTIVITY_TYPES as readonly string[]).includes(s);
}

/** Allowed `unit` for workout rows — matches Laravel `in:step,calories,minutes,sets`. */
export type WorkoutParameterUnit = "step" | "calories" | "minutes" | "sets";

export type WorkoutParameterSubmitArgs = Readonly<{
  sourceId: number | string;
  /** API expects a string, e.g. total kcal for the session. */
  value: string;
  unit: WorkoutParameterUnit;
}>;

/** Maps dashboard / detail activity keys to `search=ref:general,category:…`. */
export function categoryForActivityType(type: string): string {
  switch (type) {
    case "GL":
    case "BP":
    case "HR":
    case "TEMP":
    case "O2":
      return "parameter";
    case "workout":
      return "workout";
    case "water":
      return "water";
    case "height":
    case "weight":
      return "bmi";
    default:
      return type;
  }
}

export function activityLogTitleForApiType(apiType: string): string {
  switch (apiType) {
    case "GL":
      return "Glucose";
    case "BP":
      return "Blood pressure";
    case "TEMP":
      return "Temperature";
    case "O2":
      return "Blood oxygen (SpO₂)";
    case "HR":
      return "Heart rate";
    case "sleep":
      return "Sleep";
    case "symptom":
      return "Symptoms";
    case "mood":
      return "Mood";
    case "medicine":
      return "Medicines";
    case "water":
      return "Water";
    case "workout":
      return "Exercise";
    case "height":
      return "Height";
    case "weight":
      return "Weight";
    case "remainder":
      return "Reminders";
    default:
      return "Activity";
  }
}

export function activityTypeSupportsSubmit(apiType: string): boolean {
  return SUBMIT_SUPPORTED.has(apiType);
}

export const activitySubmitPayloads = {
  parameter(type: string, value: string): Record<string, unknown> {
    return {
      ref: "general",
      category: "parameter",
      type,
      value,
    };
  },

  water(glasses: number): Record<string, unknown> {
    return {
      ref: "general",
      category: "water",
      value: glasses,
    };
  },

  mood(valueOneToFive: number): Record<string, unknown> {
    return {
      ref: "general",
      category: "mood",
      value: valueOneToFive,
    };
  },

  medicine(name: string, dose: string): Record<string, unknown> {
    return {
      ref: "general",
      category: "medicine",
      value: name,
      dose,
    };
  },

  symptom(text: string): Record<string, unknown> {
    return {
      ref: "general",
      category: "symptom",
      value: text,
    };
  },

  sleep(hoursMinutes: string): Record<string, unknown> {
    return {
      ref: "general",
      category: "sleep",
      value: hoursMinutes,
    };
  },

  workoutCalories(calories: string): Record<string, unknown> {
    return {
      ref: "general",
      category: "workout",
      unit: "calories",
      value: calories,
    };
  },

  /**
   * Logged from exercise catalog — same wire shape as Flutter `ActivitySubmitPayloads.workoutFromExercise`
   * (`value` is minutes; `unit` is legacy `"calories"`).
   */
  workoutFromExercise(args: Readonly<{ sourceId: string; minutes: string }>): Record<string, unknown> {
    return {
      ref: "general",
      category: "workout",
      source_id: args.sourceId,
      unit: "calories",
      value: args.minutes,
    };
  },

  /**
   * POST `/patient/parameters` — e.g. `{"category":"workout","source_id":"R1T…","unit":"calories","value":"12"}`.
   * `value` and `source_id` are strings on the wire.
   */
  workoutExerciseLog(args: Readonly<WorkoutParameterSubmitArgs>): Record<string, unknown> {
    return {
      ref: "general",
      category: "workout",
      source_id: String(args.sourceId),
      unit: args.unit,
      value: args.value,
    };
  },

  /**
   * Fitness video watch time — legacy `fitness_streaming_view.dart` reward / watching goal.
   * Submitted on workout Complete (not per round). POST `/patient/parameters`.
   */
  fitnessVideoWatch(args: Readonly<{ sourceId: number | string; secondsWatched: number }>): Record<string, unknown> {
    return {
      category: "watching",
      source: "fitness_video",
      source_id: String(args.sourceId),
      value: String(Math.max(0, Math.round(args.secondsWatched))),
    };
  },

  bmi(heightFeetDotInches: string, weightKg: string): Record<string, unknown> {
    return {
      ref: "general",
      category: "bmi",
      height: heightFeetDotInches,
      weight: weightKg,
    };
  },
};

export type DigitalDiaryHubTile = Readonly<{
  title: string;
  hint: string;
  apiArg: DigitalDiaryActivityType;
}>;

export type DigitalDiaryHubSection = Readonly<{
  title: string;
  items: readonly DigitalDiaryHubTile[];
}>;

export const DIGITAL_DIARY_SECTIONS: readonly DigitalDiaryHubSection[] = [
  {
    title: DIGITAL_DIARY_COPY.sectionDailyHabits,
    items: [
      { title: "Water", hint: "Hydration", apiArg: "water" },
      { title: "Exercise", hint: "Workouts", apiArg: "workout" },
    ],
  },
  {
    title: DIGITAL_DIARY_COPY.sectionVitals,
    items: [
      { title: "Glucose", hint: "Blood sugar", apiArg: "GL" },
      { title: "Blood pressure", hint: "BP readings", apiArg: "BP" },
      { title: "Temperature", hint: "Body temp", apiArg: "TEMP" },
      { title: "SpO₂", hint: "Oxygen", apiArg: "O2" },
      { title: "Heart rate", hint: "BPM", apiArg: "HR" },
    ],
  },
  {
    title: DIGITAL_DIARY_COPY.sectionBodySleep,
    items: [
      { title: "Height", hint: "Growth / BMI", apiArg: "height" },
      { title: "Weight", hint: "Progress", apiArg: "weight" },
      { title: "Sleep", hint: "Rest", apiArg: "sleep" },
    ],
  },
  {
    title: DIGITAL_DIARY_COPY.sectionWellness,
    items: [
      { title: "Symptoms", hint: "How you feel", apiArg: "symptom" },
      { title: "Mood", hint: "Emotions", apiArg: "mood" },
      { title: "Medicines", hint: "What you took", apiArg: "medicine" },
    ],
  },
];

/** Mood scale 1–5 — same labels as {@link DigitalDiaryAddSheet} */
export const DIARY_MOOD_LABELS = ["", "Awful", "Bad", "Okay", "Good", "Great"];

function coalesceApiUnit(e: Record<string, unknown>): string {
  const raw = e.units ?? e.unit;
  if (raw == null) return "";
  const s = String(raw).trim();
  return s;
}

/**
 * Display suffix when the API omits `units` / `unit` (common for vitals).
 * Uses row `type` when present (vitals list), else the screen activity key.
 */
function fallbackUnitForDiaryRow(
  e: Record<string, unknown>,
  activityScreenType: string,
): string {
  const rowType = String(e.type ?? "").trim();
  const cat = String(e.category ?? "").trim().toLowerCase();
  const screen = activityScreenType.trim();
  const t = rowType || screen;

  if (cat === "workout" || t === "workout") {
    const u = String(e.unit ?? "").trim().toLowerCase();
    if (u === "calories") return "kcal";
    return "";
  }

  switch (t) {
    case "GL":
      return "mg/dL";
    case "BP":
      return "mmHg";
    case "TEMP":
      return "°F";
    case "O2":
      return "%";
    case "HR":
      return "bpm";
    case "water":
      return "glasses";
    default:
      return "";
  }
}

/**
 * Single-line summary for a `/patient/parameters` row.
 * @param activityScreenType — current diary tab key (`water`, `GL`, …) when the row omits `type`
 */
export function formatDiaryEntrySummary(
  e: Record<string, unknown>,
  activityScreenType = "",
): string {
  const rowType = e.type != null ? String(e.type).trim() : "";
  const screen = activityScreenType.trim();
  const effectiveType = rowType || screen;

  const value = e.value;
  const dose = e.dose;
  let apiUnit = coalesceApiUnit(e);
  if (apiUnit.toLowerCase() === "calories") {
    apiUnit = "kcal";
  }

  const cat = String(e.category ?? "").trim().toLowerCase();

  /** BMI-style rows */
  const heightRaw = e.height;
  const weightRaw = e.weight;
  if (
    heightRaw != null &&
    weightRaw != null &&
    String(heightRaw).trim().length > 0 &&
    String(weightRaw).trim().length > 0 &&
    (cat === "bmi" || effectiveType === "height" || effectiveType === "weight")
  ) {
    return `${String(heightRaw)} ft/in · ${String(weightRaw)} kg`;
  }

  if (value != null && dose != null) {
    return `${String(value)} · ${String(dose)}`;
  }

  if (value != null) {
    const valStr = String(value);

    if (effectiveType === "mood" || cat === "mood") {
      const n = typeof value === "number" ? value : Number.parseInt(valStr, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 5) {
        const label = DIARY_MOOD_LABELS[n] ?? valStr;
        return `${label} (${n}/5)`;
      }
    }

    const fallback = apiUnit.length === 0 ? fallbackUnitForDiaryRow(e, screen) : "";
    const unitPart = apiUnit.length > 0 ? apiUnit : fallback;

    if (unitPart.length > 0) {
      return `${valStr} ${unitPart}`.replace(/\s+/g, " ").trim();
    }

    return valStr;
  }

  if (rowType.length > 0) {
    return rowType;
  }
  return "Entry";
}
