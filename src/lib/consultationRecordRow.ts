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

/** Chip label next to date/time on the card — Flutter `_CommunicationBadge`. */
export function consultationCommunicationLabel(row: Record<string, unknown>): string {
  return consultationIsOnline(row) ? "Online" : "In-Person";
}

/** Mirrors Flutter `ConsultationRecordModel.statusLabel` (+ cancellation reason). */
export function consultationStatusLabel(row: Record<string, unknown>): string {
  const cancellation = pickStr(row.cancellation_reason, row.cancellationReason);
  if (cancellation) return "Cancelled";

  const status = toInt(row.status);
  if (status === 1) return "Completed";
  if (status === 2) return "Cancelled";
  return "--";
}

export type ConsultationStatusTone = "completed" | "cancelled" | "other";

/** Chip colors aligned with Flutter `OrderStatusChip` / medical-records detail banner. */
export function consultationStatusTone(label: string): ConsultationStatusTone {
  const s = label.trim().toLowerCase();
  if (s.includes("complete") || s.includes("confirm")) return "completed";
  if (s.includes("cancel")) return "cancelled";
  return "other";
}

/** `displayDate  •  displayTime` — matches Flutter `ConsultationRecordModel`. */
export function formatConsultationDateTime(row: Record<string, unknown>): string {
  const dateStr = pickStr(row.date);
  const timeStr = pickStr(row.time);

  let displayDate = dateStr;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      displayDate = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  let displayTime = timeStr;
  if (timeStr) {
    const parts = timeStr.split(":");
    const hour = Number.parseInt(parts[0] ?? "", 10);
    const minute = Number.parseInt(parts[1] ?? "", 10);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
      const dt = new Date(2000, 0, 1, hour, minute);
      displayTime = dt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  if (displayDate && displayTime) return `${displayDate}  •  ${displayTime}`;
  return displayDate || displayTime || "—";
}

export function consultationDoctorImageUrl(row: Record<string, unknown>): string | null {
  const doc = asRecord(row.doctor);
  const raw = pickStr(doc?.image, doc?.photo, doc?.profile_image, doc?.profileImage);
  return raw || null;
}
