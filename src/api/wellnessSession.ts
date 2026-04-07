import { patientFetchChecked, patientJson } from "@/api/patientHttp";

export type WellnessTypeOption = Readonly<{ value: string; label: string }>;

function parseWellnessTypeList(raw: unknown): WellnessTypeOption[] {
  const fromArray = (arr: unknown[]): WellnessTypeOption[] =>
    arr.map((item, i) => {
      if (typeof item === "string") {
        const t = item.trim();
        return { value: t, label: t };
      }
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return { value: `item-${i}`, label: String(item) };
      }
      const o = item as Record<string, unknown>;
      const label = String(
        o.name ?? o.title ?? o.label ?? o.type ?? o.service_area ?? `Option ${i + 1}`,
      ).trim();
      const value = String(o.value ?? o.id ?? o.key ?? o.code ?? label).trim();
      return { value: value || label, label: label || value };
    });

  if (Array.isArray(raw)) return fromArray(raw);
  const rec = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!rec) return [];
  const nested = rec.data ?? rec.types ?? rec.items ?? rec.results;
  if (Array.isArray(nested)) return fromArray(nested);
  return [];
}

/** GET /patient/mental_wellness/type — categories for Mental Wellness only. */
export async function fetchMentalWellnessTypes(): Promise<WellnessTypeOption[]> {
  const raw = await patientJson<unknown>("mental_wellness/type", { method: "GET" });
  return parseWellnessTypeList(raw);
}

/** POST /patient/wellness/session */
export async function postWellnessSession(payload: Record<string, unknown>): Promise<void> {
  await patientFetchChecked("wellness/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
