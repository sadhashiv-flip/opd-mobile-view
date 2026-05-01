import { patientJson } from "@/api/patientHttp";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { categoryForActivityType } from "@/lib/digitalDiary";

const VITAL_TYPES_FILTER = new Set(["GL", "BP", "HR", "TEMP", "O2"]);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseEnvelopeList(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid activities response");
  }
  const root = raw as Record<string, unknown>;
  if (root.status === false) {
    throw new Error(
      typeof root.message === "string" && root.message.trim()
        ? root.message
        : "Failed to load activities",
    );
  }
  const data = root.data;
  if (!Array.isArray(data)) return [];
  return data.map((e) => {
    if (e && typeof e === "object" && !Array.isArray(e)) {
      return { ...(e as Record<string, unknown>) };
    }
    return {};
  });
}

/**
 * GET `/patient/parameters` — list activity rows for a calendar day (Flutter `ActivitiesRepository.fetchActivities`).
 */
export async function fetchPatientParameters(
  activityType: string,
  dateYyyyMmDd: string,
): Promise<Record<string, unknown>[]> {
  try {
    if (activityType === "remainder") {
      const raw = await patientJson<unknown>("parameters?type=remainder");
      return parseEnvelopeList(raw);
    }

    const cat = categoryForActivityType(activityType);
    const qs = new URLSearchParams({
      date: dateYyyyMmDd,
      search: `ref:general,category:${cat}`,
    });
    const raw = await patientJson<unknown>(`parameters?${qs.toString()}`);
    let list = parseEnvelopeList(raw);

    if (VITAL_TYPES_FILTER.has(activityType)) {
      list = list.filter((row) => {
        const t = row.type;
        return typeof t === "string" ? t === activityType : false;
      });
    }
    return list;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(DIGITAL_DIARY_COPY.loadActivitiesGenericError);
  }
}

/**
 * POST `/patient/parameters` — log an activity (Flutter `ActivitiesRepository.submitActivity`).
 */
export async function submitPatientParameter(body: Record<string, unknown>): Promise<void> {
  const raw = await patientJson<unknown>("parameters", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const root = asRecord(raw);
  if (root?.status === false) {
    throw new Error(
      typeof root.message === "string" && root.message.trim()
        ? root.message
        : "Could not save activity",
    );
  }
}
