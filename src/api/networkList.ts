import { fetchAllPatientAddresses } from "@/api/patientAddress";
import { DEFAULT_LIST_PAGE_SIZE } from "@/api/listPagination";
import { patientJson, patientJsonList } from "@/api/patientHttp";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";

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
  /** Clinic / hospital address when provided by API. */
  networkAddress: string;
  consultationFee: number;
  /** Minutes from speciality `jsonVault` / API when present. */
  consultationTime: number | null;
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

function consultationTimeFromVault(vault: Record<string, unknown> | null): number | null {
  if (!vault) return null;
  return num(vault.consultation_time) ?? num(vault.consultationTime) ?? null;
}

/** Prefer `specialities[]` row matching `speciality_id`, then first entry. */
function extractConsultationFromSpecialities(
  raw: unknown,
  specialityId: number,
): Readonly<{ price: number | null; time: number | null }> {
  const r = asRecord(raw);
  if (!r) return { price: null, time: null };
  const specs = r.specialities;
  if (!Array.isArray(specs) || specs.length === 0) return { price: null, time: null };
  const match = specs.find((s) => {
    const o = asRecord(s);
    return o != null && num(o.speciality_id) === specialityId;
  });
  const chosen = asRecord(match ?? specs[0]);
  if (!chosen) return { price: null, time: null };
  const info = asRecord(chosen.speciality_info);
  if (!info) return { price: null, time: null };
  const vaultRaw = info.jsonVault ?? info.json_vault;
  const vault = parseJsonVault(vaultRaw);
  return {
    price: consultationPriceFromVault(vault),
    time: consultationTimeFromVault(vault),
  };
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
  const networkAddress =
    str(net?.address) ??
    str(net?.full_address) ??
    str(net?.location) ??
    str(r.hospital_address) ??
    str(r.clinic_address) ??
    str(r.branch_address) ??
    "";
  const fromSpec = extractConsultationFromSpecialities(raw, specialityId);
  const consultationFee =
    fromSpec.price ??
    num(r.fee) ??
    num(r.consultation_fee) ??
    num(r.consultation_price) ??
    num(r.price) ??
    num(r.amount) ??
    0;
  const consultationTime = fromSpec.time ?? num(r.consultation_time) ?? null;
  const imageUrl =
    str(r.image) ?? str(r.photo) ?? str(r.profile_image) ?? str(r.avatar) ?? str(r.profileImage) ?? null;

  return {
    id,
    networkId,
    name,
    degree,
    expLabel,
    networkName,
    networkAddress,
    consultationFee,
    consultationTime,
    imageUrl,
  };
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

/** Clinic row from `GET /network/list?service=dental` → `data.clnlist[]`. */
export type DentalNetworkClinicRow = Readonly<{
  available: boolean;
  distance: string;
  name: string;
  providername: string;
  city: string;
  practiceaddress: string;
  longitude: string;
  latitude: string;
  cell: string;
  providerid: number;
  clinicid: number;
  /** Maps / directions URL when provided. */
  location: string;
  pin: string;
  practicename: string;
  provider: string;
  primary_clinic: boolean;
  email: string;
}>;

function normalizeDentalClinicRow(raw: unknown, index: number): DentalNetworkClinicRow | null {
  const r = asRecord(raw);
  if (!r) return null;
  const name = str(r.name) ?? str(r.practicename) ?? `Clinic ${index + 1}`;
  const practiceaddress = str(r.practiceaddress) ?? "";
  const clinicid = num(r.clinicid) ?? num(r.clinic_id) ?? index;
  const providerid = num(r.providerid) ?? num(r.provider_id) ?? 0;
  return {
    available: Boolean(r.available),
    distance: str(r.distance) ?? "—",
    name,
    providername: str(r.providername) ?? "",
    city: str(r.city) ?? "",
    practiceaddress,
    longitude: str(r.longitude) ?? "",
    latitude: str(r.latitude) ?? "",
    cell: str(r.cell) ?? "",
    providerid,
    clinicid,
    location: str(r.location) ?? "",
    pin: str(r.pin) ?? "",
    practicename: str(r.practicename) ?? name,
    provider: str(r.provider) ?? "",
    primary_clinic: Boolean(r.primary_clinic),
    email: str(r.email) ?? "",
  };
}

function extractDentalClnlist(body: unknown): unknown[] {
  const root = asRecord(body);
  if (!root) return [];
  const data = asRecord(root.data);
  if (!data) return [];
  const list = data.clnlist;
  return Array.isArray(list) ? list : [];
}

/**
 * `GET /network/list?location=lat,lng&service=dental` (no `speciality_id`).
 * Response: `data.clnlist[]`.
 */
export async function fetchDentalNetworkClinicList(
  location: string,
  init?: { skipGlobalLoading?: boolean },
): Promise<DentalNetworkClinicRow[]> {
  const query = [
    `location=${encodeLocationQueryParam(location.trim())}`,
    `service=${encodeURIComponent("dental")}`,
  ].join("&");
  const raw = await patientJson<unknown>(`network/list?${query}`, {
    method: "GET",
    skipGlobalLoading: init?.skipGlobalLoading,
  });
  return extractDentalClnlist(raw)
    .map((row, i) => normalizeDentalClinicRow(row, i))
    .filter((x): x is DentalNetworkClinicRow => x !== null);
}

/** Vision network list: `GET /network/list?service=vision.clinic|vision.store` → `data[]` clinic rows. */
export type VisionNetworkService = "vision.clinic" | "vision.store";

function parseCoordinatePair(coords: string): Readonly<{ lat: number; lng: number }> | null {
  const parts = coords.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Distance in km between two WGS84 points (haversine). */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function hashStringToClinicId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  const n = Math.abs(h);
  return n === 0 ? 1 : n;
}

function googleMapsDirUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function normalizeVisionClinicRow(
  raw: unknown,
  index: number,
  userLat: number | null,
  userLng: number | null,
): DentalNetworkClinicRow | null {
  const r = asRecord(raw);
  if (!r) return null;
  const idRaw = str(r.id) ?? `vision-${index}`;
  const name = str(r.name) ?? `Clinic ${index + 1}`;
  const displayAddress = str(r.display_address) ?? "";
  const coordsStr = str(r.coordinates) ?? "";
  const parsed = parseCoordinatePair(coordsStr);
  const vendor = asRecord(r.vendor);
  const vendorId = num(r.vendor_id) ?? num(vendor?.id) ?? 0;

  let distanceLabel = "—";
  if (parsed && userLat != null && userLng != null) {
    distanceLabel = haversineKm(userLat, userLng, parsed.lat, parsed.lng).toFixed(1);
  }

  const locationUrl = parsed ? googleMapsDirUrl(parsed.lat, parsed.lng) : "";

  return {
    available: r.status !== false,
    distance: distanceLabel,
    name,
    providername: str(vendor?.name) ?? "",
    city: str(asRecord(r.address)?.city) ?? "",
    practiceaddress: displayAddress,
    longitude: parsed ? String(parsed.lng) : "",
    latitude: parsed ? String(parsed.lat) : "",
    cell: str(r.phone) ?? "",
    providerid: vendorId,
    clinicid: hashStringToClinicId(idRaw),
    location: locationUrl,
    pin: str(asRecord(r.address)?.pincode) ?? "",
    practicename: name,
    provider: "",
    primary_clinic: false,
    email: str(r.email) ?? "",
  };
}

/**
 * `GET /network/list?location=lat,lng&service=vision.clinic|vision.store` (no `speciality_id`).
 * Response: `{ data: Clinic[] }` (array of clinics with `display_address`, `coordinates`, etc.).
 */
export async function fetchVisionNetworkClinicList(
  location: string,
  service: VisionNetworkService,
  init?: { skipGlobalLoading?: boolean },
): Promise<DentalNetworkClinicRow[]> {
  const query = [
    `location=${encodeLocationQueryParam(location.trim())}`,
    `service=${encodeURIComponent(service)}`,
  ].join("&");
  const raw = await patientJson<unknown>(`network/list?${query}`, {
    method: "GET",
    skipGlobalLoading: init?.skipGlobalLoading,
  });
  const user = parseCoordinatePair(location.trim());
  const userLat = user?.lat ?? null;
  const userLng = user?.lng ?? null;
  return extractRows(raw)
    .map((row, i) => normalizeVisionClinicRow(row, i, userLat, userLng))
    .filter((x): x is DentalNetworkClinicRow => x !== null);
}

/**
 * Resolves `lat,lng` for {@link fetchDentalNetworkClinicList} from the same saved address
 * used in “Choose address” (primary / selected / first), then falls back to {@link readNetworkListLocation}.
 */
export async function resolveSelectedAddressLocation(): Promise<string> {
  try {
    const list = await fetchAllPatientAddresses();
    const sel = readSelectedAddress();
    const row =
      (sel ? list.find((a) => a.id === sel.id) : undefined) ??
      list.find((a) => a.isPrimary) ??
      list[0];
    const loc = row?.location?.trim();
    if (loc) return loc;
  } catch {
    // ignore
  }
  return readNetworkListLocation();
}
