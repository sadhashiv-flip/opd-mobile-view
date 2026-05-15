import { fetchAllListPages, type ListPaginationOpts, DEFAULT_LIST_PAGE_SIZE } from "@/api/listPagination";
import { patientJson, patientJsonList } from "@/api/patientHttp";

/** Row from GET `/specialties` (backend uses `specialities` in JSON). */
export type HospitalSpeciality = Readonly<{
  id: number;
  name: string;
  image: string | null;
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
  const image = typeof r.image === "string" && r.image.trim() ? r.image.trim() : null;
  const status = typeof r.status === "number" && Number.isFinite(r.status) ? r.status : null;
  if (status != null && status !== 1) return null;

  const parent = r.parent == null ? null : asFiniteId(r.parent);
  const ct = typeof r.consultation_time === "number" ? r.consultation_time : null;
  const cp = typeof r.consultation_price === "number" ? r.consultation_price : null;
  const ctype = typeof r.consultation_type === "number" ? r.consultation_type : null;

  return {
    id,
    name,
    image,
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

/** GET `/specialties?page=&limit=` — in-clinic consultation specialties. */
export async function fetchHospitalSpecialities(
  pagination?: ListPaginationOpts,
  searchQuery?: string | null,
): Promise<HospitalSpeciality[]> {
  const q = searchQuery?.trim();
  if (q) {
    // When searching, construct query string manually
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? DEFAULT_LIST_PAGE_SIZE;
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search: `name:${q}`,
    });
    const raw = await patientJson<unknown>(`specialties?${qs.toString()}`);
    return extractSpecialitiesList(raw)
      .map(normalizeHospitalSpeciality)
      .filter((x): x is HospitalSpeciality => x !== null);
  } else {
    // When not searching, use the standard paginated list
    const raw = await patientJsonList<unknown>("specialties", { method: "GET" }, pagination);
    return extractSpecialitiesList(raw)
      .map(normalizeHospitalSpeciality)
      .filter((x): x is HospitalSpeciality => x !== null);
  }
}

/** Loads every page until a short or empty response. */
export async function fetchAllHospitalSpecialities(): Promise<HospitalSpeciality[]> {
  return fetchAllListPages((opts) => fetchHospitalSpecialities(opts));
}
