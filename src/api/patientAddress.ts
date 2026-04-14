import { fetchAllListPages, type ListPaginationOpts } from "@/api/listPagination";
import { patientFetchChecked, patientJsonList } from "@/api/patientHttp";
import { readSelectedAddress, writeSelectedAddress } from "@/constants/selectedAddressStorage";

/** Normalized address row from GET /patient/address (`addressess` array, etc.). */
export type PatientAddressRecord = Readonly<{
  id: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  area: string | null;
  pincode: string;
  /** "lat,lng" */
  location: string;
  tag: string;
  name: string;
  isPrimary: boolean;
  userId: number | null;
  userType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type CreateAddressPayload = Readonly<{
  line_1: string;
  line_2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  area: string | null;
  pincode: string;
  location: string;
  tag: string;
  name: string;
  isPrimary?: boolean;
}>;

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function strNull(v: unknown): string | null {
  const s = str(v);
  return s.length ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function extractAddressArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const keys = [
    root.addressess,
    root.addresses,
    root.address_list,
    root.data,
  ] as const;
  for (const k of keys) {
    if (Array.isArray(k)) return k;
    const inner = asRecord(k);
    if (inner) {
      const nested =
        inner.addressess ??
        inner.addresses ??
        inner.items ??
        inner.list;
      if (Array.isArray(nested)) return nested;
    }
  }
  return [];
}

function normalizeAddressItem(v: unknown): PatientAddressRecord | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = str(o.id);
  if (!id) return null;
  const line1 = str(o.line_1) || str(o.line1);
  return {
    id,
    line1,
    line2: strNull(o.line_2) ?? strNull(o.line2),
    landmark: strNull(o.landmark),
    city: str(o.city),
    state: str(o.state),
    area: strNull(o.area),
    pincode: str(o.pincode),
    location: str(o.location),
    tag: str(o.tag) || str(o.name) || "HOME",
    name: str(o.name) || str(o.tag) || "HOME",
    isPrimary: Boolean(o.isPrimary ?? o.is_primary),
    userId: typeof o.user_id === "number" ? o.user_id : null,
    userType: strNull(o.user_type),
    createdAt: strNull(o.createdAt) ?? strNull(o.created_at),
    updatedAt: strNull(o.updatedAt) ?? strNull(o.updated_at),
  };
}

/** GET `/address?page=&limit=` — expects `{ addressess: [...] }` or similar. */
export async function fetchPatientAddresses(
  pagination?: ListPaginationOpts,
): Promise<PatientAddressRecord[]> {
  const raw = await patientJsonList<unknown>("address", { method: "GET" }, pagination);
  return extractAddressArray(raw)
    .map((row) => normalizeAddressItem(row))
    .filter((x): x is PatientAddressRecord => x != null);
}

/** Loads every page until a short or empty response. */
export async function fetchAllPatientAddresses(): Promise<PatientAddressRecord[]> {
  return fetchAllListPages((opts) => fetchPatientAddresses(opts));
}

/** POST /patient/address */
export async function createPatientAddress(payload: CreateAddressPayload): Promise<void> {
  const res = await patientFetchChecked("address", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await res.text();
}

/** PATCH /patient/address/:id — update existing. */
export async function updatePatientAddress(
  id: string,
  payload: CreateAddressPayload,
): Promise<void> {
  const res = await patientFetchChecked(
    `address/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  await res.text();
}

/** DELETE /patient/address/:id */
export async function deletePatientAddress(id: string): Promise<void> {
  const res = await patientFetchChecked(`address/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await res.text();
}

/** PATCH /patient/address/primary/:id — set this address as primary. */
export async function setPatientAddressPrimary(id: string): Promise<void> {
  const res = await patientFetchChecked(
    `address/primary/${encodeURIComponent(id)}`,
    { method: "PATCH" },
  );
  await res.text();
}

export function formatAddressLines(a: PatientAddressRecord): string {
  const parts = [a.line1, a.line2, a.landmark].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.join(", ");
}

export function hasAnySavedAddresses(list: readonly PatientAddressRecord[]): boolean {
  return list.length > 0;
}

/**
 * When nothing is stored or the stored id no longer exists, persist primary (else first)
 * saved address so flows that use {@link readSelectedAddress} get a valid `address_id`
 * and {@link resolveSelectedAddressLocation} matches the visible home strip.
 */
export async function ensureDefaultSelectedAddressIfNeeded(): Promise<void> {
  try {
    const data = await fetchAllPatientAddresses();
    if (data.length === 0) return;
    const stored = readSelectedAddress();
    const match = stored ? data.find((a) => a.id === stored.id) : undefined;
    if (match) return;
    const pick = data.find((a) => a.isPrimary) ?? data[0] ?? null;
    if (!pick) return;
    const displayLine = formatAddressLines(pick);
    writeSelectedAddress({ id: pick.id, displayLine, tag: pick.tag.trim() || undefined });
  } catch {
    // ignore
  }
}
