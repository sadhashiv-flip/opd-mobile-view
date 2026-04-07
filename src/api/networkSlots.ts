import { patientJson } from "@/api/patientHttp";

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

/** Normalized payload for hospital slot booking UI. */
export type NetworkSlotsPayload = Readonly<{
  networkName: string | null;
  displayAddress: string | null;
  doctor: Readonly<{
    id: number;
    name: string;
    qualification: string | null;
  }> | null;
  /** Doctor-level schedules (preferred for slot picking). */
  schedules: readonly NetworkDoctorSchedule[];
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
      networkName: null,
      displayAddress: null,
      doctor: null,
      schedules: [],
    };
  }

  const networkName = typeof data.name === "string" ? data.name : null;
  const displayAddress = typeof data.display_address === "string" ? data.display_address : null;

  const doc = pickDoctorNetwork(data.network_doctor, doctorId);
  let doctor: NetworkSlotsPayload["doctor"] = null;
  let schedules: readonly NetworkDoctorSchedule[] = [];

  if (doc) {
    const did = typeof doc.id === "number" ? doc.id : Number(doc.id);
    const name = typeof doc.name === "string" ? doc.name : "Doctor";
    const qualification = typeof doc.qualification === "string" ? doc.qualification : null;
    if (Number.isFinite(did)) {
      doctor = { id: did, name, qualification };
    }
    schedules = normalizeSchedules(doc.schedules);
  }

  return {
    networkName,
    displayAddress,
    doctor,
    schedules,
  };
}

/** GET `/network/slots/:network_id?doctor_id=` */
export async function fetchNetworkSlots(
  networkId: string,
  doctorId: string | number,
): Promise<NetworkSlotsPayload> {
  const q = new URLSearchParams();
  q.set("doctor_id", String(doctorId));
  const raw = await patientJson<unknown>(
    `network/slots/${encodeURIComponent(networkId)}?${q.toString()}`,
    { method: "GET" },
  );
  return parsePayload(raw, doctorId);
}
