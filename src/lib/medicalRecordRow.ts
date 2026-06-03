export function asRecord(v: unknown): Record<string, unknown> | null {
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

export function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function labTestAdditionalInfo(row: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(row.additional_info) ?? asRecord(row.additionalInfo);
}

export function labTestTitle(row: Record<string, unknown>): string {
  const title = pickStr(row.title, row.name);
  if (title) return title;
  const addl = labTestAdditionalInfo(row);
  const codes = addl?.test_codes ?? addl?.testCodes ?? row.test_codes ?? row.testCodes;
  if (Array.isArray(codes) && codes.length > 0) {
    const first = asRecord(codes[0]);
    const name = first ? pickStr(first.name) : "";
    if (name) return name;
  }
  return "Lab Test";
}

/** Mirrors Flutter `LabTestRecordModel.statusLabel`. */
export function labTestStatusLabel(row: Record<string, unknown>): string {
  const cancellation = pickStr(row.cancellation_reason, row.cancellationReason);
  if (cancellation) return "Cancelled";
  const status = pickNum(row.status);
  if (status === 1) return "Completed";
  return "--";
}

export type LabTestStatusTone = "completed" | "cancelled" | "other";

export function labTestStatusTone(label: string): LabTestStatusTone {
  const s = label.trim().toLowerCase();
  if (s.includes("complete") || s.includes("report") || s.includes("confirm")) return "completed";
  if (s.includes("cancel")) return "cancelled";
  return "other";
}

/** `displayDate` only — matches Flutter `LabTestRecordModel.displayDate`. */
export function labTestDisplayDate(row: Record<string, unknown>): string {
  const raw = pickStr(row.date);
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return raw;
}

export function labTestInvoiceId(row: Record<string, unknown>): string {
  return pickStr(row.invoice_id, row.invoiceId, row.order_id, row.orderId);
}

export function labTestOrderDetailId(row: Record<string, unknown>): string {
  return pickStr(
    asRecord(row.info)?.id,
    row.consultation_info_id,
    row.consultationInfoId,
    row.service_id,
    row.serviceId,
    row.invoice_id,
    row.invoiceId,
    row.order_id,
    row.orderId,
  );
}

export function prescriptionDoctorName(row: Record<string, unknown>): string {
  const appt = asRecord(row.appointment);
  const doc = appt ? asRecord(appt.doctor) : asRecord(row.doctor);
  const name = pickStr(doc?.name, row.doctor_name, row.doctorName);
  return name ? (name.startsWith("Dr.") ? name : `Dr. ${name}`) : "Prescription";
}

export function prescriptionMedicineCount(row: Record<string, unknown>): number {
  const details = asRecord(row.details);
  let n = 0;
  for (const key of ["chronic", "others"] as const) {
    const list = details?.[key];
    if (Array.isArray(list)) n += list.length;
  }
  if (n > 0) return n;
  const chronic = row.chronic_medicines ?? row.chronicMedicines;
  const others = row.other_medicines ?? row.otherMedicines;
  if (Array.isArray(chronic)) n += chronic.length;
  if (Array.isArray(others)) n += others.length;
  return n;
}

export function prescriptionDate(row: Record<string, unknown>): string {
  return pickStr(row.createdAtDate, row.created_at_date, row.created_at, row.createdAt);
}

export function prescriptionId(row: Record<string, unknown>): string {
  return pickStr(row.id, row.prescription_id, row.prescriptionId);
}

export function prescriptionIsChronic(row: Record<string, unknown>): boolean {
  return row.isChronic === true || row.is_chronic === true;
}

export function formatRecordDate(raw: string): string {
  if (!raw.trim()) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function serviceRequestDetails(row: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(row.details);
}

export function serviceRequestType(row: Record<string, unknown>): string {
  return pickStr(row.type).toLowerCase().replace(/\s+/g, "");
}

/** Mirrors Flutter `ServiceRequestModel.typeLabel`. */
export function serviceRequestTypeLabel(row: Record<string, unknown>): string {
  const t = serviceRequestType(row);
  switch (t) {
    case "mentalwellness":
      return "Mental Wellness";
    case "nutrition":
    case "diet&nutrition":
      return "Diet & Nutrition";
    case "womens":
      return "Women's Health";
    case "dental":
      return "Dental";
    case "vision":
      return "Vision";
    case "vaccine":
      return "Vaccine";
    case "yoga":
      return "Yoga";
    default:
      return pickStr(row.type) || "Service";
  }
}

/** Mirrors Flutter card title: `serviceName` else `typeLabel`. */
export function serviceRequestTitle(row: Record<string, unknown>): string {
  const details = serviceRequestDetails(row);
  const serviceName = pickStr(details?.service, row.service_name, row.serviceName);
  if (serviceName) return serviceName;
  return serviceRequestTypeLabel(row);
}

export function serviceRequestArea(row: Record<string, unknown>): string {
  const details = serviceRequestDetails(row);
  return pickStr(details?.service_area, details?.serviceArea, row.service_area, row.serviceArea);
}

function formatServiceRequestDateTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Booking time when set, else created date — Flutter `displayBookingTime` / `displayDate`. */
export function serviceRequestDisplayTime(row: Record<string, unknown>): string {
  const details = serviceRequestDetails(row);
  const booking = pickStr(
    details?.booking_time,
    details?.bookingTime,
    row.booking_time,
    row.bookingTime,
    row.datetime,
  );
  if (booking) return formatServiceRequestDateTime(booking);
  const created = pickStr(row.createdAt, row.created_at, row.date);
  return formatRecordDate(created);
}

/** Mental wellness, nutrition, yoga — always online in Flutter `isOnlineVisit`. */
export function serviceRequestIsOnlineVisit(row: Record<string, unknown>): boolean {
  const t = serviceRequestType(row);
  return (
    t === "mentalwellness" ||
    t === "nutrition" ||
    t === "yoga" ||
    t === "diet&nutrition"
  );
}

export function serviceRequestVisitTypeLabel(row: Record<string, unknown>): string {
  if (serviceRequestIsOnlineVisit(row)) return "Online";
  const vt = pickStr(row.visit_type, row.visitType).toUpperCase();
  if (vt === "HOME_PICKUP" || vt === "HOME_VISIT" || vt === "HOME_SERVICE") return "Home Visit";
  return "Self Visit";
}

export function serviceRequestStatusLabel(row: Record<string, unknown>): string {
  const cancel = pickStr(row.cancellation_reason, row.cancellationReason);
  if (cancel) return "Cancelled";
  const status = pickNum(row.status);
  if (status != null && status >= 3) return "Cancelled";
  if (status === 1) return "Active";
  if (status === 2) return "Completed";
  if (status === 0) return "Pending";
  return pickStr(row.statusText, row.status_text) || "Unknown";
}

/** @deprecated Use {@link serviceRequestDisplayTime} for list cards. */
export function serviceRequestBookingTime(row: Record<string, unknown>): string {
  return serviceRequestDisplayTime(row);
}

export function serviceRequestInvoiceId(row: Record<string, unknown>): string {
  return pickStr(row.invoice_id, row.invoiceId);
}

export function healthRecordValue(row: Record<string, unknown>): string {
  const type = pickStr(row.type).toUpperCase();
  const value = pickStr(row.value);
  const unit = vitalUnit(type, pickStr(row.unit));
  if (!value) return "—";
  return unit ? `${value} ${unit}` : value;
}

export function vitalTypeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case "HR":
      return "Heart Rate";
    case "O2":
      return "SpO2";
    case "TEMP":
      return "Temperature";
    case "BP":
      return "Blood Pressure";
    case "RR":
      return "Respiratory Rate";
    case "SUGAR":
      return "Blood Sugar";
    default:
      return type || "Vital";
  }
}

/** Matches Flutter `VitalRecordCard._vitalColor`. */
export function vitalAccentColor(type: string): string {
  switch (type.toUpperCase()) {
    case "HR":
      return "#dc2626";
    case "O2":
      return "#2563eb";
    case "TEMP":
      return "#d97706";
    case "BP":
      return "#7c4dff";
    case "RR":
      return "#16a34a";
    case "SUGAR":
      return "#ff5224";
    default:
      return "#5c6570";
  }
}

export function vitalIconGradient(type: string): string {
  const c = vitalAccentColor(type);
  return `linear-gradient(135deg, ${c} 0%, ${c}99 100%)`;
}

export function healthRecordSource(row: Record<string, unknown>): string {
  return pickStr(row.source);
}

function vitalUnit(type: string, unit: string): string {
  if (unit) return unit;
  switch (type.toUpperCase()) {
    case "HR":
      return "bpm";
    case "O2":
      return "%";
    case "TEMP":
      return "°F";
    case "BP":
      return "mmHg";
    case "RR":
      return "breaths/min";
    case "SUGAR":
      return "mg/dL";
    default:
      return "";
  }
}

export function healthRecordDatetime(row: Record<string, unknown>): string {
  return pickStr(row.datetime, row.date, row.created_at, row.createdAt);
}

/** `dd MMM yyyy  •  hh:mm AM` — matches Flutter `HealthRecordModel.displayDateTime`. */
export function formatHealthRecordDateTime(row: Record<string, unknown>): string {
  const raw = healthRecordDatetime(row);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return time ? `${date}  •  ${time}` : date;
}

export function medicineName(row: Record<string, unknown>): string {
  return pickStr(row.value, row.title) || "Medicine";
}

export function medicineDose(row: Record<string, unknown>): string {
  return pickStr(row.dose);
}

export function medicineIsChronic(row: Record<string, unknown>): boolean {
  return symptomIsChronic(row);
}

export function moodValue(row: Record<string, unknown>): number {
  const v = pickNum(row.value);
  if (v == null || v < 1 || v > 5) return 0;
  return v;
}

export function moodLabel(value: number): string {
  switch (value) {
    case 1:
      return "Very Sad";
    case 2:
      return "Sad";
    case 3:
      return "Neutral";
    case 4:
      return "Happy";
    case 5:
      return "Very Happy";
    default:
      return "Unknown";
  }
}

export function moodEmoji(value: number): string {
  switch (value) {
    case 1:
      return "😢";
    case 2:
      return "😔";
    case 3:
      return "😐";
    case 4:
      return "😊";
    case 5:
      return "😄";
    default:
      return "❓";
  }
}

export function moodAccentColor(value: number): string {
  switch (value) {
    case 1:
      return "#dc2626";
    case 2:
      return "#ff7043";
    case 3:
      return "#d97706";
    case 4:
      return "#66bb6a";
    case 5:
      return "#16a34a";
    default:
      return "#5c6570";
  }
}

export function measurementTypeLabel(row: Record<string, unknown>): string {
  const t = pickStr(row.type).toLowerCase();
  if (t === "height") return "Height Update";
  if (t === "weight") return "Weight Update";
  return "BMI Update";
}

export function measurementDetailNum(row: Record<string, unknown>, key: string): number | null {
  const details = asRecord(row.details);
  if (!details) return null;
  const v = details[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function bmiValue(row: Record<string, unknown>): number | null {
  return pickNum(row.value);
}

export function bmiCategory(bmi: number | null): string {
  if (bmi == null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function bmiCategoryColor(cat: string): string {
  switch (cat) {
    case "Underweight":
      return "#2563eb";
    case "Normal":
      return "#16a34a";
    case "Overweight":
      return "#d97706";
    case "Obese":
      return "#dc2626";
    default:
      return "#5c6570";
  }
}

export function conditionIsOngoing(row: Record<string, unknown>): boolean {
  return pickStr(row.ended).length === 0;
}

export function conditionDisplayLabel(row: Record<string, unknown>): string {
  const c = pickStr(row.condition);
  if (!c) return "Condition";
  return c.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function labTestCategory(row: Record<string, unknown>): string {
  return pickStr(row.category);
}

export function labTestIsHomePickup(row: Record<string, unknown>): boolean {
  return pickStr(row.visit_type, row.visitType).trim().toUpperCase() === "HOME_PICKUP";
}

export function labTestVisitTypeLabel(row: Record<string, unknown>): string {
  return labTestIsHomePickup(row) ? "Home Pickup" : "Self Visit";
}

export function labTestIsSponsored(row: Record<string, unknown>): boolean {
  return row.sponsored === true || row.sponsored === 1 || pickStr(row.sponsored) === "1";
}

/** Flutter `additional_info.collection_slot_time`. */
export function labTestCollectionSlot(row: Record<string, unknown>): string {
  const addl = labTestAdditionalInfo(row);
  return pickStr(
    addl?.collection_slot_time,
    addl?.collectionSlotTime,
    row.collection_slot_time,
    row.collectionSlotTime,
  );
}

export function symptomIsChronic(row: Record<string, unknown>): boolean {
  return pickStr(row.ref).toLowerCase() === "chronic";
}

export function conditionName(row: Record<string, unknown>): string {
  return pickStr(row.condition) || "Condition";
}
