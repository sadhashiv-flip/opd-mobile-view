import { patientFetchChecked } from "@/api/patientHttp";

const RELATIONSHIP_FALLBACK = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Other",
] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function parseDependentTypeNames(body: unknown): string[] {
  const root = asRecord(body);
  if (!root) return [];
  const data = root.data;
  if (!Array.isArray(data)) return [];
  const names: string[] = [];
  for (const row of data) {
    const o = asRecord(row);
    const name = o?.name;
    if (typeof name === "string") {
      const t = name.trim();
      if (t) names.push(t);
    }
  }
  return names;
}

/** `GET /patient/dependent/types` — relationship options for add-member form. */
export async function fetchDependentRelationshipTypes(): Promise<string[]> {
  try {
    const res = await patientFetchChecked("dependent/types", { method: "GET" });
    const body: unknown = await res.json();
    const names = parseDependentTypeNames(body);
    return names.length > 0 ? names : [...RELATIONSHIP_FALLBACK];
  } catch {
    return [...RELATIONSHIP_FALLBACK];
  }
}
