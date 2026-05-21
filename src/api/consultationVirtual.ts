import { fetchAllListPages, type ListPaginationOpts } from "@/api/listPagination";
import { patientJson, patientJsonList } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

/**
 * Virtual slots screen `location.state` + `sessionStorage` under `opd-mobile-view.virtualSlots.{issueId}`.
 * `spid` for `availableSlots` is the issue’s parent specialty id (same as {@link VirtualSpecialtySlotsState.parent}).
 */
export type VirtualSpecialtySlotsState = Readonly<{
  parent: number;
  issueTitle: string;
  spid: number;
  /** Preferred language for {@link fetchAvailableSlots} (required for new flow). */
  language: string;
}>;

export type SpecialityDoctor = Readonly<{
  id: number;
  name: string;
  qualification: string | null;
  image: string | null;
  gender: string | null;
  experience: string | number | null;
  speciality: { name: string; id: number } | null;
}>;

export type AvailableSlot = Readonly<{
  date: string;
  time: string;
  available: string;
  displayTime: string;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeDoctor(raw: unknown): SpecialityDoctor | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = typeof r.id === "number" ? r.id : Number(r.id);
  if (!Number.isFinite(id)) return null;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const qualification =
    typeof r.qualification === "string" ? r.qualification.trim() : null;
  const image =
    typeof r.image === "string" && r.image.trim() ? r.image.trim() : null;
  const gender =
    typeof r.gender === "string" && r.gender.trim() ? r.gender.trim() : null;
  const exp = r.experience;
  const specRaw = asRecord(r.speciality);
  const specId = specRaw ? asFiniteId(specRaw.id) : null;
  const speciality =
    specRaw && typeof specRaw.name === "string" && specId != null
      ? { name: specRaw.name, id: specId }
      : null;
  return {
    id,
    name: name || "Doctor",
    qualification,
    image,
    gender,
    experience: exp as string | number | null,
    speciality,
  };
}

function asFiniteId(idRaw: unknown): number | null {
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) return idRaw;
  if (typeof idRaw === "string") {
    const n = Number(idRaw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** GET `/speciality/:parentId/doctors?page=&limit=` */
export async function fetchSpecialityDoctors(
  parentId: number,
  pagination?: ListPaginationOpts,
): Promise<SpecialityDoctor[]> {
  const raw = await patientJsonList<unknown>(
    `speciality/${parentId}/doctors`,
    { method: "GET" },
    pagination,
  );
  const root = asRecord(raw) ?? {};
  const list = root.doctors;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeDoctor).filter((x): x is SpecialityDoctor => x !== null);
}

export async function fetchAllSpecialityDoctors(parentId: number): Promise<SpecialityDoctor[]> {
  return fetchAllListPages((opts) => fetchSpecialityDoctors(parentId, opts));
}

export function doctorImageUrl(d: SpecialityDoctor): string | null {
  return resolveProfileImageUrl(d.image);
}

export type FetchAvailableSlotsParams = Readonly<{
  date: string;
  /** Issue `parent` from `/issues` (sent as query `spid`). */
  spid: number;
  language: string;
  /** Follow-up rebook — prior completed `appointment_id` (patient_app `getAvailableSlots`). */
  appointmentId?: string | null;
}>;

function normalizeSlot(raw: unknown): AvailableSlot | null {
  const r = asRecord(raw);
  if (!r) return null;
  const date = typeof r.date === "string" ? r.date : "";
  const time = typeof r.time === "string" ? r.time : "";
  const availRaw = r.available;
  let available = "";
  if (typeof availRaw === "string") available = availRaw;
  else if (typeof availRaw === "number" || typeof availRaw === "boolean") {
    available = String(availRaw);
  }
  const displayTime =
    typeof r.displayTime === "string" && r.displayTime.trim()
      ? r.displayTime.trim()
      : time;
  if (!date || !time) return null;
  return { date, time, available, displayTime };
}

/** GET `/availableSlots?date=&spid=&language=` (+ optional `appointment_id` for follow-up) */
export async function fetchAvailableSlots(
  params: FetchAvailableSlotsParams,
): Promise<AvailableSlot[]> {
  const q = new URLSearchParams();
  q.set("date", params.date);
  q.set("spid", String(params.spid));
  q.set("language", params.language);
  const followId = params.appointmentId?.trim();
  if (followId) q.set("appointment_id", followId);
  const raw = await patientJson<unknown>(`availableSlots?${q.toString()}`, { method: "GET" });
  const root = asRecord(raw) ?? {};
  const list = root.slots;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeSlot).filter((x): x is AvailableSlot => x !== null);
}

export async function fetchAllAvailableSlots(
  params: FetchAvailableSlotsParams,
): Promise<AvailableSlot[]> {
  return fetchAvailableSlots(params);
}

/** Local calendar date `YYYY-MM-DD`. */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatExperience(exp: string | number | null | undefined): string {
  if (exp == null || exp === "") return "";
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return `${exp}+ years exp`;
  }
  const s = String(exp).trim();
  if (!s) return "";
  const n = Number.parseFloat(s);
  if (Number.isFinite(n)) return `${n}+ years exp`;
  return s;
}
