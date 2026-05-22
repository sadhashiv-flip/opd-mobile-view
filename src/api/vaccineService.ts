import { applyListPaginationToPath, fetchAllListPages } from "@/api/listPagination";
import { patientJson, patientJsonList } from "@/api/patientHttp";

export type VaccineServiceItem = Readonly<{
  id: number;
  name: string;
  serviceType: string | null;
}>;

export type VaccinePrescriptionRef = Readonly<{ id: string }>;

export type VaccineServiceRequestPayload = Readonly<{
  address_id: string;
  preferred_date_time: string;
  request: number[];
  alternate_phone: string;
  conditions: string;
  note: string;
  user_id: number;
  language: string;
  /** Required for children age 5 or below — attachment ids from `POST /upload`. */
  prescription?: readonly VaccinePrescriptionRef[];
}>;

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function extractServiceRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const keys = [root.data, root.services, root.items, root.results, root.records] as const;
  for (const k of keys) {
    if (Array.isArray(k)) return k;
    const inner = asRecord(k);
    if (inner) {
      const a = inner.data ?? inner.items ?? inner.services;
      if (Array.isArray(a)) return a;
    }
  }
  return [];
}

function parseServiceRow(raw: unknown): VaccineServiceItem | null {
  const o = asRecord(raw);
  if (!o) return null;
  const idRaw = o.id ?? o.service_id ?? o.serviceId;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : typeof idRaw === "string"
        ? Number(idRaw)
        : NaN;
  if (!Number.isFinite(id)) return null;
  const name = str(o.name) ?? str(o.service_name) ?? str(o.title) ?? str(o.serviceName);
  if (!name) return null;
  return {
    id,
    name,
    serviceType: str(o.service_type) ?? str(o.serviceType) ?? str(o.type),
  };
}

function normalizeServiceList(body: unknown): VaccineServiceItem[] {
  const rows = extractServiceRows(body);
  const out: VaccineServiceItem[] = [];
  for (const r of rows) {
    const item = parseServiceRow(r);
    if (item) out.push(item);
  }
  return out;
}

/** GET `/services?search=service_type:vaccine` (paginated until exhausted). */
export async function fetchAllVaccineServices(): Promise<VaccineServiceItem[]> {
  return fetchAllListPages(
    async (opts) => {
      const path = applyListPaginationToPath("services?search=service_type:vaccine", opts);
      const body = await patientJsonList<unknown>(path);
      return normalizeServiceList(body);
    },
    { perPage: 50 },
  );
}

/** POST `/service/vaccine/request` */
export async function postVaccineServiceRequest(
  payload: VaccineServiceRequestPayload,
): Promise<unknown> {
  return patientJson<unknown>("service/vaccine/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
