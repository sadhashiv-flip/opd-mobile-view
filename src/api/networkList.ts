import { DEFAULT_LIST_PAGE_SIZE } from "@/api/listPagination";
import { patientJsonList } from "@/api/patientHttp";

/** Default map center (Hyderabad area) — override via `localStorage` key {@link NETWORK_LIST_LOCATION_STORAGE_KEY}. */
export const DEFAULT_NETWORK_LIST_LOCATION = "17.44337659121972,78.3751130104065";

export const NETWORK_LIST_LOCATION_STORAGE_KEY = "opd-mobile-view.networkList.location";

/** Same as {@link DEFAULT_LIST_PAGE_SIZE} — kept for existing imports. */
export const NETWORK_LIST_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export type FetchNetworkListParams = Readonly<{
  /** Comma-separated `lat,lng`. */
  location: string;
  service: string;
  speciality_id: number;
  page: number;
  limit: number;
}>;

export type NetworkListDoctorRow = Readonly<{
  /** From API `doctor_id` (preferred) or `id`. */
  id: string;
  /** From API `network_id` or `network.id` — used for `GET /network/slots/:network_id`. */
  networkId: string;
  name: string;
  degree: string;
  /** e.g. "21+ years exp" */
  expLabel: string;
  networkName: string;
  consultationFee: number;
  imageUrl: string | null;
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

function parseJsonVault(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return asRecord(p);
    } catch {
      return null;
    }
  }
  return asRecord(raw);
}

function consultationPriceFromVault(vault: Record<string, unknown> | null): number | null {
  if (!vault) return null;
  return num(vault.consultation_price) ?? num(vault.consultationPrice) ?? null;
}

/** Prefer `specialities[]` row matching `speciality_id`, then first entry. */
function extractConsultationPriceFromSpecialities(raw: unknown, specialityId: number): number | null {
  const r = asRecord(raw);
  if (!r) return null;
  const specs = r.specialities;
  if (!Array.isArray(specs) || specs.length === 0) return null;
  const match = specs.find((s) => {
    const o = asRecord(s);
    return o != null && num(o.speciality_id) === specialityId;
  });
  const chosen = asRecord(match ?? specs[0]);
  if (!chosen) return null;
  const info = asRecord(chosen.speciality_info);
  if (!info) return null;
  const vaultRaw = info.jsonVault ?? info.json_vault;
  return consultationPriceFromVault(parseJsonVault(vaultRaw));
}

function formatExperienceLabel(r: Record<string, unknown>): string {
  const years = num(r.experience);
  if (years != null) return `${years}+ years exp`;
  const label =
    str(r.exp) ??
    str(r.experience) ??
    str(r.experience_label) ??
    str(r.exp_label) ??
    "";
  return label;
}

function normalizeDoctorRow(raw: unknown, index: number, specialityId: number): NetworkListDoctorRow | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id =
    str(r.doctor_id) ??
    str(r.id) ??
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
  const expLabel = formatExperienceLabel(r);
  const net = asRecord(r.network);
  const networkId = str(r.network_id) ?? str(net?.id) ?? "";
  const networkName =
    str(net?.name) ??
    str(r.hospital) ??
    str(r.hospital_name) ??
    str(r.clinic) ??
    str(r.clinic_name) ??
    str(r.center) ??
    "";
  const fromVault = extractConsultationPriceFromSpecialities(raw, specialityId);
  const consultationFee =
    fromVault ??
    num(r.fee) ??
    num(r.consultation_fee) ??
    num(r.consultation_price) ??
    num(r.price) ??
    num(r.amount) ??
    0;
  const imageUrl =
    str(r.image) ?? str(r.photo) ?? str(r.profile_image) ?? str(r.avatar) ?? str(r.profileImage) ?? null;

  return { id, networkId, name, degree, expLabel, networkName, consultationFee, imageUrl };
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

/**
 * `lat,lng` with a literal comma — `URLSearchParams` encodes comma as `%2C`, which some backends reject.
 */
function encodeLocationQueryParam(location: string): string {
  const t = location.trim();
  if (!t.includes(",")) return encodeURIComponent(t);
  return t
    .split(",")
    .map((s) => encodeURIComponent(s.trim()))
    .join(",");
}

/** GET `{VITE_API_BASE_URL}/network/list?location=&service=&speciality_id=&page=&limit=` */
export async function fetchNetworkDoctorListPage(
  params: FetchNetworkListParams,
  init?: { skipGlobalLoading?: boolean },
): Promise<NetworkListDoctorRow[]> {
  const query = [
    `location=${encodeLocationQueryParam(params.location)}`,
    `service=${encodeURIComponent(params.service)}`,
    `speciality_id=${encodeURIComponent(String(params.speciality_id))}`,
  ].join("&");
  const raw = await patientJsonList<unknown>(
    `network/list?${query}`,
    {
      method: "GET",
      skipGlobalLoading: init?.skipGlobalLoading,
    },
    { page: params.page, limit: params.limit },
  );
  const offset = (params.page - 1) * params.limit;
  return extractRows(raw)
    .map((row, i) => normalizeDoctorRow(row, offset + i, params.speciality_id))
    .filter((x): x is NetworkListDoctorRow => x !== null);
}
