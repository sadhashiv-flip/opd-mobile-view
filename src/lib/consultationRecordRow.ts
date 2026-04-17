function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "";
}

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

export function consultationDoctorName(row: Record<string, unknown>): string {
  const doc = asRecord(row.doctor);
  return pickStr(doc?.name, row.doctorName, row.doctor_name) || "Doctor";
}

export function consultationDoctorSpecialty(row: Record<string, unknown>): string {
  const doc = asRecord(row.doctor);
  const spec = doc ? (asRecord(doc.speciality) ?? asRecord(doc.specialty)) : null;
  return pickStr(spec?.name, row.doctorSpeciality, row.doctor_speciality, row.speciality_name);
}

export function consultationInvoiceId(row: Record<string, unknown>): string {
  return pickStr(row.invoice_id, row.invoiceId);
}

/** True when the string looks like a live consultation / booking id (e.g. `APP10029…`). */
export function looksLikeConsultationAppointmentId(value: string): boolean {
  return /^APP\d/i.test(value.trim());
}

/**
 * Appointment / booking id for post-visit chat (`GET /patient/chat/messages/:id`).
 * History rows sometimes omit top-level `appointment_id` but set nested `additional_info` or `info.id`.
 */
export function consultationAppointmentId(row: Record<string, unknown>): string {
  const add = asRecord(row.additional_info) ?? asRecord(row.additionalInfo);
  const booking = add ? (asRecord(add.booking_details) ?? asRecord(add.bookingDetails)) : null;
  const info = asRecord(row.info);
  const fromFields = pickStr(
    row.appointment_id,
    row.appointmentId,
    add?.appointment_id,
    add?.appointmentId,
    booking?.appointment_id,
    booking?.appointmentId,
    row.reference_appointment_id,
    row.referenceAppointmentId,
    row.network_booking_id,
    row.networkBookingId,
    row.booking_id,
    row.bookingId,
    info?.appointment_id,
    info?.appointmentId,
    info?.id,
  );
  if (fromFields) return fromFields;
  const rid = pickStr(row.id);
  return looksLikeConsultationAppointmentId(rid) ? rid : "";
}

function consultationCommunicationRawUpper(row: Record<string, unknown>): string {
  const add = asRecord(row.additional_info) ?? asRecord(row.additionalInfo);
  const info = asRecord(row.info);
  return pickStr(
    row.communication,
    row.communication_type,
    row.communicationType,
    info?.communication,
    add?.communication,
  )
    .trim()
    .toUpperCase();
}

/** Same as Flutter `ConsultationRecordModel.isOnline`: `communication` is `ONLINE` (case-insensitive). */
export function consultationIsOnline(row: Record<string, unknown>): boolean {
  return consultationCommunicationRawUpper(row) === "ONLINE";
}

/** Chip label next to date/time on the card. */
export function consultationCommunicationLabel(row: Record<string, unknown>): string {
  return consultationIsOnline(row) ? "Online" : "In-person";
}

/** Mirrors Flutter `ConsultationRecordModel.statusLabel`. */
export function consultationStatusLabel(row: Record<string, unknown>): string {
  const cancellation = pickStr(row.cancellation_reason, row.cancellationReason);
  if (cancellation) return "Cancelled";

  const isPatientJoined = toInt(row.isPatientJoined, row.is_patient_joined);
  const isDocJoined = toInt(row.isDocJoined, row.is_doc_joined);
  if (isPatientJoined === 1 && isDocJoined === 1) return "Completed";

  const status = toInt(row.status);
  const completed = toInt(row.completed);
  const date = pickStr(row.date);
  const time = pickStr(row.time);

  if (status === 1 && completed === 0) {
    const appointmentDt = Date.parse(`${date} ${time}`.trim());
    if (!Number.isNaN(appointmentDt) && appointmentDt > Date.now()) return "Upcoming";
    return "Missed";
  }
  if (status === 0) return "Pending";
  return "Completed";
}

export function formatConsultationDateTime(row: Record<string, unknown>): string {
  const dateStr = pickStr(row.date);
  const timeStr = pickStr(row.time);
  if (!dateStr) return timeStr || "—";
  const combined = `${dateStr} ${timeStr}`.trim();
  const d = new Date(combined);
  if (Number.isNaN(d.getTime())) {
    return [dateStr, timeStr].filter(Boolean).join(", ") || "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function consultationDoctorImageUrl(row: Record<string, unknown>): string | null {
  const doc = asRecord(row.doctor);
  const raw = pickStr(doc?.image, doc?.photo, doc?.profile_image, doc?.profileImage);
  return raw || null;
}
