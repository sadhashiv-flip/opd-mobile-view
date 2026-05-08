import { patientJson } from "@/api/patientHttp";
import type { ChronicConditionId } from "@/lib/chronicConditions";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return false;
}

function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export type ChronicCheckResult = Readonly<{
  chronicModule: boolean;
  medicineModule: boolean;
  available: boolean;
  amount: number;
}>;

export async function fetchChronicCheck(): Promise<ChronicCheckResult> {
  const raw = await patientJson<unknown>("chronic/check", { method: "GET" });
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  return {
    chronicModule: asBool(data?.chronic_module),
    medicineModule: asBool(data?.medicine_module),
    available: asBool(data?.available),
    amount: asNum(data?.amount),
  };
}

export async function updateChronicOptIn(): Promise<string> {
  const raw = await patientJson<unknown>("chronic/chronic_optIn", { method: "GET" });
  const root = asRecord(raw);
  return asText(root?.message) || "Chronic opt-in updated.";
}

export type ChronicConditionRow = Readonly<{
  id: string;
  condition: string;
  note: string;
  history: string;
  since: string | null;
  ended: string | null;
}>;

function parseConditionRow(v: unknown): ChronicConditionRow | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = asText(o.id);
  const condition = asText(o.condition);
  if (!id || !condition) return null;
  const since = asText(o.since);
  const ended = asText(o.ended);
  return {
    id,
    condition,
    note: asText(o.note),
    history: asText(o.history),
    since: since || null,
    ended: ended || null,
  };
}

export async function fetchChronicConditions(): Promise<ChronicConditionRow[]> {
  const raw = await patientJson<unknown>("chronic/conditions", { method: "GET" });
  const root = asRecord(raw);
  const arr = root?.conditions;
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => parseConditionRow(x)).filter((x): x is ChronicConditionRow => x != null);
}

export type UpsertChronicConditionPayload = Readonly<{
  condition?: ChronicConditionId;
  note: string;
  history: string;
  since: string;
  ended?: string | null;
}>;

export async function createChronicCondition(
  payload: UpsertChronicConditionPayload & Readonly<{ condition: ChronicConditionId }>,
): Promise<void> {
  await patientJson<unknown>("chronic/condition", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateChronicCondition(
  id: string,
  payload: UpsertChronicConditionPayload,
): Promise<void> {
  await patientJson<unknown>(`chronic/condition/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type ChronicParameterRow = Readonly<{
  id: string;
  type: string;
  value: string;
  datetime: string | null;
}>;

function parseParameterRow(v: unknown): ChronicParameterRow | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = asText(o.id);
  return {
    id,
    type: asText(o.type),
    value: asText(o.value),
    datetime: asText(o.datetime) || null,
  };
}

export async function fetchChronicParametersByDate(dateYmd: string): Promise<ChronicParameterRow[]> {
  const raw = await patientJson<unknown>(
    `parameters?search=ref:chronic,category:parameter&date=${encodeURIComponent(dateYmd)}&is_latest_activities=true`,
    { method: "GET" },
  );
  const root = asRecord(raw);
  const arr = root?.data;
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => parseParameterRow(x)).filter((x): x is ChronicParameterRow => x != null);
}

export async function addChronicParameter(payload: Readonly<{
  type: "TEMP" | "O2" | "HR" | "BP" | "GL";
  value: string;
}>): Promise<string> {
  const raw = await patientJson<unknown>("parameters", {
    method: "POST",
    body: JSON.stringify({
      ref: "chronic",
      category: "parameter",
      type: payload.type,
      value: payload.value,
    }),
  });
  return asText(asRecord(raw)?.message) || "Parameter added.";
}

export type ChronicProfileEntry = Readonly<{
  id: string;
  value: string;
  dose: string;
  datetime: string | null;
}>;

function parseProfileEntry(v: unknown): ChronicProfileEntry | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = asText(o.id);
  if (!id) return null;
  return {
    id,
    value: asText(o.value),
    dose: asText(o.dose),
    datetime: asText(o.datetime) || null,
  };
}

export async function fetchChronicProfileCategory(params: Readonly<{
  category: "symptom" | "medicine" | "note";
  dateIso?: string;
}>): Promise<ChronicProfileEntry[]> {
  const searchParts = [`ref:chronic`, `category:${params.category}`];
  const dateIso = params.dateIso?.trim();
  if (dateIso) {
    searchParts.push(`datetime:${dateIso}`);
  }
  const raw = await patientJson<unknown>(
    `parameters?search=${encodeURIComponent(searchParts.join(","))}`,
    { method: "GET" },
  );
  const root = asRecord(raw);
  const arr = root?.data;
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => parseProfileEntry(x)).filter((x): x is ChronicProfileEntry => x != null);
}

export async function addChronicProfileCategory(payload: Readonly<{
  category: "symptom" | "medicine" | "note";
  value: string;
  dose?: number;
}>): Promise<string> {
  const raw = await patientJson<unknown>("parameters", {
    method: "POST",
    body: JSON.stringify({
      ref: "chronic",
      category: payload.category,
      value: payload.value,
      ...(payload.dose == null ? {} : { dose: payload.dose }),
    }),
  });
  return asText(asRecord(raw)?.message) || "Entry added.";
}
