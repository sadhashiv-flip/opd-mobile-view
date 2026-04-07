import { patientJson } from "@/api/patientHttp";

/** Row from GET `/specialties` (backend uses `specialities` in JSON). */
export type HospitalSpeciality = Readonly<{
  id: number;
  name: string;
  consultation_time: number | null;
  consultation_price: number | null;
  consultation_type: number | null;
  parent: number | null;
  status: number | null;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asFiniteId(idRaw: unknown): number | null {
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) return idRaw;
  if (typeof idRaw === "string") {
    const n = Number(idRaw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeHospitalSpeciality(raw: unknown): HospitalSpeciality | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = asFiniteId(r.id);
  if (id === null) return null;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const status = typeof r.status === "number" && Number.isFinite(r.status) ? r.status : null;
  if (status != null && status !== 1) return null;

  const parent = r.parent == null ? null : asFiniteId(r.parent);
  const ct = typeof r.consultation_time === "number" ? r.consultation_time : null;
  const cp = typeof r.consultation_price === "number" ? r.consultation_price : null;
  const ctype = typeof r.consultation_type === "number" ? r.consultation_type : null;

  return {
    id,
    name,
    consultation_time: ct,
    consultation_price: cp,
    consultation_type: ctype,
    parent,
    status,
  };
}

function extractSpecialitiesList(body: unknown): unknown[] {
  const root = asRecord(body);
  if (!root) return [];
  const a = root.specialities ?? root.specialties;
  if (Array.isArray(a)) return a;
  return [];
}

/** GET `/specialties` — in-clinic consultation specialties. */
export async function fetchHospitalSpecialities(): Promise<HospitalSpeciality[]> {
  const raw = await patientJson<unknown>("specialties", { method: "GET" });
  return extractSpecialitiesList(raw)
    .map(normalizeHospitalSpeciality)
    .filter((x): x is HospitalSpeciality => x !== null);
}
