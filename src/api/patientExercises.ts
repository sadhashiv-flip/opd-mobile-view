import { patientJson } from "@/api/patientHttp";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Mirrors `ActivitiesRepository._parseExercisesList` (patient_app). */
function parseExercisesList(root: Record<string, unknown>): Record<string, unknown>[] {
  let list: unknown;
  const data = root.data;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    const m = data as Record<string, unknown>;
    list = m.exercises ?? m.items ?? m.data;
  } else {
    list = root.exercises;
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((e): e is Record<string, unknown> => e !== null && typeof e === "object" && !Array.isArray(e))
    .map((e) => ({ ...(e as Record<string, unknown>) }));
}

export type FetchPatientExercisesOpts = Readonly<{
  page?: number;
  limit?: number;
  /** Passed as `search=name:…` when non-empty. */
  nameSearch?: string | null;
}>;

/**
 * GET `/patient/exercises` — digital diary workout catalog (patient_app `ActivitiesRepository.fetchExercises`).
 */
export async function fetchPatientExercises(
  opts: FetchPatientExercisesOpts = {},
): Promise<Record<string, unknown>[]> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const q = opts.nameSearch?.trim();
  if (q) qs.set("search", `name:${q}`);

  try {
    const raw = await patientJson<unknown>(`exercises?${qs.toString()}`);
    const root = asRecord(raw);
    if (!root) {
      throw new Error("Invalid exercises response");
    }
    if (root.status === false) {
      throw new Error(
        typeof root.message === "string" && root.message.trim()
          ? root.message
          : "Failed to load exercises",
      );
    }
    return parseExercisesList(root);
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(DIGITAL_DIARY_COPY.workoutCatalogGenericError);
  }
}
