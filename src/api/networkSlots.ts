import { patientJson } from "@/api/patientHttp";
import { parseVendorDatedSlotsFromDoctorJson } from "@/utils/vendorConsultationSlots";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export type NetworkSlotTiming = Readonly<{
  id: number;
  opening: string;
  closing: string;
}>;

export type NetworkDoctorSchedule = Readonly<{
  day: string;
  short_code: string;
  id: number;
  timings: readonly NetworkSlotTiming[];
}>;

/** Date-specific slot from vendor network API (e.g. Practo). */
export type VendorDatedSlot = Readonly<{
  date: string;
  time: string;
  vendorSlotId: string;
}>;

/** Normalized payload for hospital slot booking UI. */
export type NetworkSlotsPayload = Readonly<{
  networkId: string | null;
  networkName: string | null;
  displayAddress: string | null;
  doctor: Readonly<{
    id: number;
    name: string;
    qualification: string | null;
  }> | null;
  /** Doctor-level schedules (legacy Flip/partner flow). */
  schedules: readonly NetworkDoctorSchedule[];
  /** Vendor API discrete slots per date. */
  datedSlots: readonly VendorDatedSlot[];
}>;

function normalizeTimings(raw: unknown): NetworkSlotTiming[] {
  if (!Array.isArray(raw)) return [];
  const out: NetworkSlotTiming[] = [];
  for (const t of raw) {
    const o = asRecord(t);
    if (!o) continue;
    const id = typeof o.id === "number" ? o.id : Number(o.id);
    if (!Number.isFinite(id)) continue;
    const opening = typeof o.opening === "string" ? o.opening : "";
    const closing = typeof o.closing === "string" ? o.closing : "";
    if (!opening && !closing) continue;
    out.push({ id, opening, closing });
  }
  return out;
}

function normalizeSchedules(raw: unknown): NetworkDoctorSchedule[] {
  if (!Array.isArray(raw)) return [];
  const out: NetworkDoctorSchedule[] = [];
  for (const row of raw) {
    const o = asRecord(row);
    if (!o) continue;
    const id = typeof o.id === "number" ? o.id : Number(o.id);
    if (!Number.isFinite(id)) continue;
    const day = typeof o.day === "string" ? o.day : "";
    const short_code = typeof o.short_code === "string" ? o.short_code : "";
    const timings = normalizeTimings(o.timings);
    out.push({ day, short_code, id, timings });
  }
  return out;
}

function pickDoctorNetwork(
  networkDoctor: unknown,
  doctorId: string | number,
): Record<string, unknown> | null {
  if (!Array.isArray(networkDoctor)) return null;
  const want = String(doctorId);
  for (const d of networkDoctor) {
    const o = asRecord(d);
    if (!o) continue;
    const idRaw = o.id;
    const id =
      typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw) : "";
    if (id === want) return o;
  }
  return asRecord(networkDoctor[0]);
}

function parsePayload(body: unknown, doctorId: string | number): NetworkSlotsPayload {
  const root = asRecord(body);
  const data = asRecord(root?.data) ?? asRecord(body);
  if (!data) {
    return {
      networkId: null,
      networkName: null,
      displayAddress: null,
      doctor: null,
      schedules: [],
      datedSlots: [],
    };
  }

  const networkId =
    typeof data.id === "number" || typeof data.id === "string"
      ? String(data.id)
      : null;
  const networkName = typeof data.name === "string" ? data.name : null;
  const displayAddress = typeof data.display_address === "string" ? data.display_address : null;

  const doc = pickDoctorNetwork(data.network_doctor, doctorId);
  let doctor: NetworkSlotsPayload["doctor"] = null;
  let schedules: readonly NetworkDoctorSchedule[] = [];
  let datedSlots: readonly VendorDatedSlot[] = [];

  if (doc) {
    const did = typeof doc.id === "number" ? doc.id : Number(doc.id);
    const name = typeof doc.name === "string" ? doc.name : "Doctor";
    const qualification = typeof doc.qualification === "string" ? doc.qualification : null;
    if (Number.isFinite(did)) {
      doctor = { id: did, name, qualification };
    }
    schedules = normalizeSchedules(doc.schedules);
    datedSlots = parseVendorDatedSlotsFromDoctorJson(doc);
  }

  return {
    networkId,
    networkName,
    displayAddress,
    doctor,
    schedules,
    datedSlots,
  };
}

export type FetchNetworkSlotsOptions = Readonly<{
  vendorCode?: string;
  /** patient_app always sends `user_id` for booking slots; omit for reschedule-only calls. */
  userId?: string;
}>;

/** GET `/network/slots/:network_id?doctor_id=&vendor_code=&user_id=` */
export async function fetchNetworkSlots(
  networkId: string,
  doctorId: string | number,
  options?: FetchNetworkSlotsOptions,
): Promise<NetworkSlotsPayload> {
  const q = new URLSearchParams();
  q.set("doctor_id", String(doctorId));
  const vc = options?.vendorCode?.trim();
  if (vc) q.set("vendor_code", vc);
  const uid = options?.userId?.trim();
  if (uid) q.set("user_id", uid);
  const raw = await patientJson<unknown>(
    `network/slots/${encodeURIComponent(networkId)}?${q.toString()}`,
    { method: "GET" },
  );
  return parsePayload(raw, doctorId);
}
