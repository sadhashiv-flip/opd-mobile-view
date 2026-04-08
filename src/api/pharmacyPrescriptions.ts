import { patientJson } from "@/api/patientHttp";
import type { PharmacyMockMedicine, PharmacyMockPrescription } from "@/constants/pharmacyMockData";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function pickStr(...candidates: readonly unknown[]): string {
  for (const v of candidates) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
  }
  return "";
}

function toDateLabel(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const d = new Date(v.trim());
  if (Number.isNaN(d.getTime())) return v.trim();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeMedicines(raw: unknown): PharmacyMockMedicine[] {
  if (!Array.isArray(raw)) return [];
  const out: PharmacyMockMedicine[] = [];
  for (const m of raw) {
    const o = asRecord(m);
    if (!o) continue;
    const name = pickStr(o.name, o.medicine_name, o.drug_name, o.item_name);
    if (!name) continue;
    out.push({
      name,
      form: pickStr(o.form, o.type, o.dosage_form, o.medicine_type) || "—",
      durationLabel: pickStr(o.duration, o.duration_label, o.days, o.duration_days) || "—",
      frequencyLabel: pickStr(o.frequency, o.frequency_label, o.dosage, o.dose) || "—",
    });
  }
  return out;
}

function isNoneSlot(v: string): boolean {
  return /^none$/i.test(v.trim());
}

/** Builds frequency text from LIST line items (`morning` / `afternoon` / `night` / `weekly`). */
function frequencyFromListLine(line: Record<string, unknown>): string {
  const parts: string[] = [];
  const weekly = pickStr(line.weekly);
  if (weekly && weekly !== "0") {
    parts.push(`${weekly}×/week`);
  }
  const slots: readonly [string, unknown][] = [
    ["Morning", line.morning],
    ["Afternoon", line.afternoon],
    ["Night", line.night],
  ];
  for (const [label, raw] of slots) {
    const v = pickStr(raw);
    if (v && !isNoneSlot(v)) {
      parts.push(`${label}: ${v}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function durationLabelFromDays(daysRaw: unknown): string {
  const d = pickStr(daysRaw);
  if (!d) return "—";
  const n = Number(d);
  if (Number.isFinite(n) && n >= 0) {
    return n === 1 ? "1 Day" : `${n} Days`;
  }
  return d;
}

/** `details.chronic` + `details.others` from GET /prescriptions LIST type. */
function normalizeMedicinesFromDetails(detailsRaw: unknown): PharmacyMockMedicine[] {
  const d = asRecord(detailsRaw);
  if (!d) return [];
  const chronic = Array.isArray(d.chronic) ? d.chronic : [];
  const others = Array.isArray(d.others) ? d.others : [];
  const lines = [...chronic, ...others];
  const out: PharmacyMockMedicine[] = [];
  for (const m of lines) {
    const o = asRecord(m);
    if (!o) continue;
    const name = pickStr(o.name);
    if (!name) continue;
    const morning = pickStr(o.morning);
    const afternoon = pickStr(o.afternoon);
    const night = pickStr(o.night);
    const weekly = pickStr(o.weekly);
    const schedule =
      morning || afternoon || night || weekly
        ? {
            morning: morning || undefined,
            afternoon: afternoon || undefined,
            night: night || undefined,
            weekly: weekly || undefined,
          }
        : undefined;
    out.push({
      name,
      form: pickStr(o.type, o.form) || "—",
      durationLabel: durationLabelFromDays(o.days),
      frequencyLabel: frequencyFromListLine(o),
      schedule,
    });
  }
  return out;
}

function doctorDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "—";
  if (/^dr\.?\s/i.test(t)) return t;
  return `Dr. ${t}`;
}

function specialtyFromDoctor(doctorRaw: unknown): string {
  const doc = asRecord(doctorRaw);
  if (!doc) return "";
  const spec = asRecord(doc.speciality) ?? asRecord(doc.specialty);
  return pickStr(spec?.name, doc.specialty, doc.specialization);
}

function normalizeSymptoms(o: Record<string, unknown>): string {
  const direct = pickStr(o.symptoms, o.symptom, o.diagnosis);
  if (direct) return direct;
  const list = o.symptom_list ?? o.symptoms_list;
  if (Array.isArray(list)) {
    const parts = list
      .map((x) => (typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return "—";
}

/**
 * Maps one API prescription object into the pharmacy UI card model.
 * Supports Flip `GET /prescriptions` shape: `id`, `appointment`, `details.chronic` / `details.others`, `createdAtDate`.
 */
export function normalizePrescriptionItem(raw: unknown): PharmacyMockPrescription | null {
  const o = asRecord(raw);
  if (!o) return null;

  const prescriptionId = pickStr(o.id, o.prescription_id, o.prescriptionId);
  if (!prescriptionId) return null;

  const appointment = asRecord(o.appointment);
  const details = asRecord(o.details);
  const typeStr = pickStr(o.type);
  const isFlipList =
    appointment != null &&
    details != null &&
    (typeStr === "LIST" || Array.isArray(details.chronic) || Array.isArray(details.others));

  let doctorName = "";
  let specialty = "";
  let medicines: PharmacyMockMedicine[];
  let medicineCount: number;
  let dateLabel: string;
  let symptoms: string;

  const base = (): PharmacyMockPrescription => ({
    prescriptionId,
    doctorName: doctorName || "—",
    specialty: specialty || "—",
    dateLabel: dateLabel || "—",
    medicineCount,
    symptoms,
    medicines,
  });

  if (isFlipList) {
    const doc = appointment ? asRecord(appointment.doctor) : null;
    const rawName = doc ? pickStr(doc.name) : "";
    doctorName = rawName ? doctorDisplayName(rawName) : "—";
    specialty = specialtyFromDoctor(appointment?.doctor) || "—";
    medicines = normalizeMedicinesFromDetails(o.details);
    medicineCount = medicines.length;
    dateLabel =
      pickStr(o.createdAtDate, o.date_label, o.dateLabel) ||
      toDateLabel(o.createdAt ?? o.updatedAt ?? o.prescribed_date);
    symptoms = appointment ? pickStr(appointment.symptoms) || "—" : "—";
    const diagnosis = appointment ? pickStr(appointment.diagnosis) || "—" : "—";
    const recommendation = appointment ? pickStr(appointment.recommendation) || "—" : "—";
    const purpose = appointment ? pickStr(appointment.purpose) || "—" : "—";
    const notes = pickStr(o.notes, o.note, appointment?.notes) || "";
    const appointmentId = pickStr(o.appointment_id, o.appointmentId, appointment?.id);
    return {
      ...base(),
      ...(appointmentId ? { appointmentId } : {}),
      diagnosis,
      recommendation,
      purpose,
      notes,
    };
  }

  const doctorObj = asRecord(o.doctor) ?? asRecord(o.physician) ?? asRecord(o.doctor_details);
  doctorName = pickStr(
    o.doctor_name,
    o.doctorName,
    doctorObj?.name,
    doctorObj?.full_name,
    doctorObj?.doctor_name,
  );
  specialty = pickStr(
    o.specialty,
    o.specialization,
    o.department,
    doctorObj?.specialty,
    doctorObj?.specialization,
  );
  medicines = normalizeMedicines(o.medicines ?? o.medicine ?? o.items ?? o.medicine_list);
  const countRaw = o.medicine_count ?? o.medicines_count ?? o.total_medicines;
  medicineCount =
    typeof countRaw === "number" && Number.isFinite(countRaw) && countRaw >= 0
      ? countRaw
      : medicines.length;
  dateLabel =
    pickStr(o.date_label, o.dateLabel) ||
    toDateLabel(o.date ?? o.prescribed_date ?? o.createdAt ?? o.prescription_date);
  symptoms = normalizeSymptoms(o);

  return base();
}

function extractPrescriptionArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const r = asRecord(raw);
  if (!r) return [];
  const d = r.data;
  if (Array.isArray(d)) return d;
  const dr = asRecord(d);
  if (dr) {
    if (Array.isArray(dr.list)) return dr.list;
    if (Array.isArray(dr.prescriptions)) return dr.prescriptions;
    if (Array.isArray(dr.items)) return dr.items;
  }
  if (Array.isArray(r.prescriptions)) return r.prescriptions;
  if (Array.isArray(r.list)) return r.list;
  if (Array.isArray(r.items)) return r.items;
  return [];
}

/** GET `/prescriptions` — scoped by auth session; no user/patient id in the URL. */
export async function fetchPatientPrescriptions(): Promise<PharmacyMockPrescription[]> {
  const raw = await patientJson<unknown>("prescriptions", {
    method: "GET",
    skipGlobalLoading: true,
  });
  const arr = extractPrescriptionArray(raw);
  const out: PharmacyMockPrescription[] = [];
  for (const item of arr) {
    const p = normalizePrescriptionItem(item);
    if (p) out.push(p);
  }
  return out;
}
