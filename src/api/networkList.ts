import { patientJson } from "@/api/patientHttp";

/** Default map center (Hyderabad area) — override via `localStorage` key {@link NETWORK_LIST_LOCATION_STORAGE_KEY}. */
export const DEFAULT_NETWORK_LIST_LOCATION = "17.44337659121972,78.3751130104065";

export const NETWORK_LIST_LOCATION_STORAGE_KEY = "opd-mobile-view.networkList.location";

export type FetchNetworkListParams = Readonly<{
  /** Comma-separated `lat,lng`. */
  location: string;
  service: string;
  speciality_id: number;
}>;

export type NetworkListDoctorRow = Readonly<{
  id: string;
  name: string;
  degree: string;
  exp: string;
  hospital: string;
  fee: number;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    const s = String(v).trim();
    return s.length ? s : null;
  }
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const keys = [
    root.data,
    root.doctors,
    root.network,
    root.list,
    root.items,
    root.results,
    root.records,
    root.rows,
  ] as const;
  for (const k of keys) {
    if (Array.isArray(k)) return k;
    const inner = asRecord(k);
    if (inner) {
      const a = inner.data ?? inner.items ?? inner.doctors ?? inner.list;
      if (Array.isArray(a)) return a;
    }
  }
  return [];
}

function normalizeDoctorRow(raw: unknown, index: number): NetworkListDoctorRow | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id =
    str(r.id) ??
    str(r.doctor_id) ??
    str(r.doctorId) ??
    str(r.uuid) ??
    `network-doc-${index}`;
  const name = str(r.name) ?? str(r.full_name) ?? str(r.fullName) ?? str(r.doctor_name);
  if (!name) return null;
  const degree =
    str(r.degree) ??
    str(r.qualification) ??
    str(r.education) ??
    str(r.qualifications) ??
    "";
  const exp =
    str(r.exp) ??
    str(r.experience) ??
    str(r.experience_label) ??
    str(r.exp_label) ??
    "";
  const hospital =
    str(r.hospital) ??
    str(r.hospital_name) ??
    str(r.clinic) ??
    str(r.clinic_name) ??
    str(r.center) ??
    "";
  const fee =
    num(r.fee) ??
    num(r.consultation_fee) ??
    num(r.consultation_price) ??
    num(r.price) ??
    num(r.amount) ??
    0;

  return { id, name, degree, exp, hospital, fee };
}

/** Resolved location string for `network/list?location=`. */
export function readNetworkListLocation(): string {
  try {
    const v = localStorage.getItem(NETWORK_LIST_LOCATION_STORAGE_KEY)?.trim();
    if (v) return v;
  } catch {
    // ignore
  }
  return DEFAULT_NETWORK_LIST_LOCATION;
}

/** GET `/network/list?location=&service=&speciality_id=` */
export async function fetchNetworkDoctorList(params: FetchNetworkListParams): Promise<NetworkListDoctorRow[]> {
  const q = new URLSearchParams();
  q.set("location", params.location);
  q.set("service", params.service);
  q.set("speciality_id", String(params.speciality_id));
  const raw = await patientJson<unknown>(`network/list?${q.toString()}`, { method: "GET" });
  return extractRows(raw)
    .map((row, i) => normalizeDoctorRow(row, i))
    .filter((x): x is NetworkListDoctorRow => x !== null);
}
