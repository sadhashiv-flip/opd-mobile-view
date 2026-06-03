import { asRecord, pickNum, pickStr } from "@/lib/medicalRecordRow";

export type PrescriptionMedicineItem = Readonly<{
  name: string;
  type: string;
  days: string;
  morning: string;
  afternoon: string;
  night: string;
  weekly: string;
  isChronic: boolean;
}>;

function toInt(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string" || typeof v === "boolean") {
      const n = Number.parseInt(String(v), 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function parseMedicineItem(raw: unknown, isChronic: boolean): PrescriptionMedicineItem | null {
  const o = asRecord(raw);
  if (!o) return null;
  const name = pickStr(o.name);
  if (!name) return null;
  return {
    name,
    type: pickStr(o.type),
    days: pickStr(o.days),
    morning: pickStr(o.morning),
    afternoon: pickStr(o.afternoon),
    night: pickStr(o.night),
    weekly: pickStr(o.weekly),
    isChronic: isChronic || o.isChronic === true,
  };
}

export function prescriptionAppointment(row: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(row.appointment);
}

export function prescriptionDoctorNameRaw(row: Record<string, unknown>): string {
  const appt = prescriptionAppointment(row);
  const doc = appt ? asRecord(appt.doctor) : asRecord(row.doctor);
  return pickStr(doc?.name, row.doctor_name, row.doctorName);
}

export function prescriptionDoctorDisplayName(row: Record<string, unknown>): string {
  const name = prescriptionDoctorNameRaw(row);
  if (!name) return "Doctor";
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

export function prescriptionDoctorSpecialty(row: Record<string, unknown>): string {
  const appt = prescriptionAppointment(row);
  const doc = appt ? asRecord(appt.doctor) : asRecord(row.doctor);
  const spec = doc ? (asRecord(doc.speciality) ?? asRecord(doc.specialty)) : null;
  return pickStr(spec?.name, row.doctor_speciality, row.doctorSpeciality);
}

export function prescriptionDoctorExperience(row: Record<string, unknown>): string {
  const appt = prescriptionAppointment(row);
  const doc = appt ? asRecord(appt.doctor) : asRecord(row.doctor);
  return pickStr(doc?.experience, row.doctor_experience);
}

export function prescriptionDoctorRating(row: Record<string, unknown>): number | null {
  const appt = prescriptionAppointment(row);
  const doc = appt ? asRecord(appt.doctor) : null;
  return pickNum(doc?.rating);
}

export function prescriptionIsChronic(row: Record<string, unknown>): boolean {
  return row.isChronic === true || row.is_chronic === true;
}

/** Mirrors Flutter `PrescriptionRecordModel.statusLabel`. */
export function prescriptionStatusLabel(row: Record<string, unknown>): string {
  const cancel = pickStr(row.cancelNote, row.cancel_note);
  if (cancel) return "Cancelled";
  const status = toInt(row.status);
  if (status >= 3) return "Cancelled";
  if (status === 1) return "Active";
  if (status === 2) return "Completed";
  if (status === 0) return "Inactive";
  return "Unknown";
}

export type PrescriptionStatusTone = "active" | "completed" | "cancelled" | "pending" | "inactive" | "other";

export function prescriptionStatusTone(label: string): PrescriptionStatusTone {
  const s = label.trim().toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("active")) return "active";
  if (s.includes("complete")) return "completed";
  if (s.includes("pending")) return "pending";
  if (s.includes("inactive")) return "inactive";
  return "other";
}

export function prescriptionChronicMedicines(row: Record<string, unknown>): readonly PrescriptionMedicineItem[] {
  const details = asRecord(row.details);
  const list = details?.chronic;
  if (!Array.isArray(list)) return [];
  const out: PrescriptionMedicineItem[] = [];
  for (const item of list) {
    const m = parseMedicineItem(item, true);
    if (m) out.push(m);
  }
  return out;
}

export function prescriptionOtherMedicines(row: Record<string, unknown>): readonly PrescriptionMedicineItem[] {
  const details = asRecord(row.details);
  const list = details?.others;
  if (!Array.isArray(list)) return [];
  const out: PrescriptionMedicineItem[] = [];
  for (const item of list) {
    const m = parseMedicineItem(item, false);
    if (m) out.push(m);
  }
  return out;
}

export function prescriptionAllMedicines(row: Record<string, unknown>): readonly PrescriptionMedicineItem[] {
  return [...prescriptionChronicMedicines(row), ...prescriptionOtherMedicines(row)];
}

export function prescriptionMedicineCount(row: Record<string, unknown>): number {
  return prescriptionAllMedicines(row).length;
}

export function prescriptionFirstMedicineName(row: Record<string, unknown>): string {
  const all = prescriptionAllMedicines(row);
  return all[0]?.name ?? "";
}

export function prescriptionCreatedAtDate(row: Record<string, unknown>): string {
  return pickStr(row.createdAtDate, row.created_at_date);
}

export function prescriptionNotes(row: Record<string, unknown>): string {
  return pickStr(row.notes, row.note);
}

export function prescriptionPurpose(row: Record<string, unknown>): string {
  const appt = prescriptionAppointment(row);
  return pickStr(appt?.purpose, row.purpose);
}

export function prescriptionDiagnosis(row: Record<string, unknown>): string {
  const appt = prescriptionAppointment(row);
  return pickStr(appt?.diagnosis, row.diagnosis);
}

export function prescriptionRecommendation(row: Record<string, unknown>): string {
  const appt = prescriptionAppointment(row);
  return pickStr(appt?.recommendation, row.recommendation);
}

function isPrescriptionRowId(value: string): boolean {
  return /^PR/i.test(value.trim());
}

export function prescriptionReportAppointmentId(row: Record<string, unknown>): string {
  const appt = pickStr(row.appointment_id, row.appointmentId, prescriptionAppointment(row)?.id).trim();
  if (appt && !isPrescriptionRowId(appt)) return appt;
  return "";
}

export function prescriptionNeedsReportLookup(row: Record<string, unknown>): boolean {
  return !prescriptionReportAppointmentId(row) && pickStr(row.id).length > 0;
}

function isValidTiming(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower.length > 0 && lower !== "none";
}

export function medicineTimings(med: PrescriptionMedicineItem): readonly string[] {
  const list: string[] = [];
  if (isValidTiming(med.morning)) list.push(med.morning);
  if (isValidTiming(med.afternoon)) list.push(med.afternoon);
  if (isValidTiming(med.night)) list.push(med.night);
  return list;
}

export function medicineDurationText(med: PrescriptionMedicineItem): string {
  if (!med.days || med.days === "0") return "";
  const d = Number.parseInt(med.days, 10);
  if (Number.isFinite(d) && d > 0) return d === 1 ? "1 day" : `${d} days`;
  return "";
}

export function medicineWeeklyText(med: PrescriptionMedicineItem): string {
  if (!med.weekly || med.weekly === "0") return "";
  const w = Number.parseInt(med.weekly, 10);
  if (Number.isFinite(w) && w > 0) return w === 1 ? "1x/week" : `${w}x/week`;
  return "";
}

export function timingChipMeta(timing: string): Readonly<{ icon: "morning" | "afternoon" | "night" | "other"; color: string }> {
  const t = timing.toLowerCase();
  if (t.includes("breakfast")) return { icon: "morning", color: "#d97706" };
  if (t.includes("lunch")) return { icon: "afternoon", color: "#2563eb" };
  if (t.includes("dinner")) return { icon: "night", color: "#7c4dff" };
  return { icon: "other", color: "#5c6570" };
}
