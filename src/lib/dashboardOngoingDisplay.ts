/**
 * Display helpers for `/patient/dashboard` ongoing rows — aligned with
 * `patient_app` `Order.fromInvoiceJson` / `DashboardUpcomingOrdersSection`.
 */

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function firstNonEmpty(strings: Array<string | undefined | null>): string {
  for (const s of strings) {
    if (typeof s === "string") {
      const t = s.trim();
      if (t) return t;
    }
  }
  return "";
}

export function transactionTypeFromRow(row: Record<string, unknown>): string {
  const raw = firstNonEmpty([
    row.order_type?.toString(),
    row.transaction_type?.toString(),
    row.transactionType?.toString(),
    row.service_type?.toString(),
    row.serviceType?.toString(),
    row.category?.toString(),
    row.type?.toString(),
  ]);
  if (!raw) return "";
  return raw.replaceAll(" ", "_").replaceAll("-", "_").toUpperCase();
}

/** Same category labels as Dart `_displayType` (plus APPOINTMENT → Consultation). */
export function displayCategoryFromTx(tx: string): string {
  switch (tx) {
    case "APPOINTMENT":
    case "CONSULTATION":
      return "Consultation";
    case "LABTEST":
      return "Lab Test";
    case "PHARMACY":
    case "CHRONIC_MED":
      return "Pharmacy";
    case "DENTAL":
      return "Dental";
    case "VISION":
      return "Vision";
    case "VACCINE":
      return "Vaccine";
    case "GYM_OPT_IN":
    case "GYM":
      return "Gym";
    case "MENTALWELLNESS":
    case "YOGA":
      return "Mental Wellness";
    case "NUTRITION":
      return "Nutrition";
    case "PLAN":
      return "Subscriptions";
    case "CHRONIC_OPT_IN":
      return "Chronic";
    default:
      if (!tx) return "Order";
      return tx
        .split("_")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
  }
}

function isConsultationExpired(info: Record<string, unknown>): boolean {
  const dateStr = typeof info.date === "string" ? info.date.trim() : "";
  if (!dateStr) return false;
  const timeStr = typeof info.time === "string" ? info.time.trim() : "";
  const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
  const scheduledAt = Date.parse(combined);
  if (Number.isNaN(scheduledAt)) return false;
  return Date.now() > scheduledAt + 10 * 60 * 1000;
}

/**
 * Service workflow code from `data.info.status` (same as order details / `order/...` invoice)
 * or top-level `row.status` when numeric. Prefer **info** first so payment strings on the
 * invoice root do not override `info.status` (see `mapOngoingStatusLabel` order).
 */
export function parseOngoingServiceStatusCode(
  row: Record<string, unknown>,
  info: Record<string, unknown>,
): number | null {
  const st = info.status;
  if (typeof st === "number" && Number.isFinite(st)) return st;
  if (typeof st === "string") {
    const p = Number.parseInt(st.trim(), 10);
    if (!Number.isNaN(p)) return p;
  }
  const jsonSt = row.status;
  if (typeof jsonSt === "number" && Number.isFinite(jsonSt)) return jsonSt;
  if (typeof jsonSt === "string") {
    const p = Number.parseInt(jsonSt.trim(), 10);
    if (!Number.isNaN(p)) return p;
  }
  return null;
}

export function mapOngoingStatusLabel(
  row: Record<string, unknown>,
  info: Record<string, unknown>,
  tx: string,
): string {
  const statusCode = parseOngoingServiceStatusCode(row, info);
  if (statusCode != null) {
    switch (statusCode) {
      case 1:
        return "Completed";
      case 2:
        return "Cancelled";
      case 9:
        return "Expired";
      case 4:
        /** Matches {@link consultationInfoStatusLabelOffline} / order `order/...` */
        return "Payment pending";
      case 5:
        if (tx === "CONSULTATION" && isConsultationExpired(info)) return "Expired";
        if (tx === "MENTALWELLNESS") return "Upcoming Session";
        if (tx === "CONSULTATION" || tx === "APPOINTMENT")
          return "Upcoming Appointment";
        /** Non–doctor-consultation / list-style `info.status` 5 — see `invoiceListStatusLabelFromInfoStatus` */
        return "Confirmed";
      case 3:
        return "Confirm Changes";
      case 0:
        return "Waiting for Confirmation";
      case 6:
        return "Inprogress";
      case 7:
      case 8:
        return "Pending";
      default:
        break;
    }
  }

  const payment = (row.status?.toString() ?? "").toLowerCase();
  if (["cancelled", "canceled", "failed", "refunded"].includes(payment)) return "Cancelled";
  if (["success", "paid", "completed", "complete"].includes(payment)) return "Completed";
  if (["pending", "created", "processing"].includes(payment)) {
    return payment === "processing" ? "Processing" : "Pending";
  }

  const statusText = firstNonEmpty([
    row.statusText?.toString(),
    row.status_text?.toString(),
    info.statusText?.toString(),
    info.status_text?.toString(),
  ]).toLowerCase();
  if (statusText.includes("payment pending")) return "Payment pending";
  if (statusText.includes("pending")) return "Pending";
  if (statusText.includes("confirm")) return "Confirm Changes";
  if (statusText.includes("complete")) return "Completed";
  if (statusText.includes("cancel")) return "Cancelled";

  const stStr = (info.status?.toString() ?? "").toLowerCase();
  if (stStr.includes("cancel")) return "Cancelled";
  if (stStr.includes("complete") || stStr.includes("paid")) return "Completed";

  if (tx === "CONSULTATION" && (info.date == null || info.date === "")) return "Pending";

  return "Processing";
}

function parseOngoingDate(row: Record<string, unknown>, info: Record<string, unknown>): Date {
  const details = asRecord(row.details);
  const slot = asRecord(details.slot);
  const add = asRecord(row.additional_info);
  const infoAdd = asRecord(info.additional_info as unknown);

  const scheduledDate = firstNonEmpty([
    details.booking_time?.toString(),
    details.preferred_date_time?.toString(),
    slot.slot_date?.toString(),
    row.booking_time?.toString(),
    row.preferred_date_time?.toString(),
    typeof info.date === "string" ? info.date : "",
    add.collection_date?.toString(),
    infoAdd.collection_date?.toString(),
    row.date?.toString(),
    row.collection_date?.toString(),
  ]);

  if (scheduledDate) {
    const d = Date.parse(scheduledDate);
    if (!Number.isNaN(d)) return new Date(d);
  }

  const created = firstNonEmpty([
    row.createdAt?.toString(),
    row.created_at?.toString(),
    row.invoice_date?.toString(),
    row.created?.toString(),
  ]);
  if (created) {
    const d = Date.parse(created);
    if (!Number.isNaN(d)) return new Date(d);
  }

  const dateStr = typeof info.date === "string" ? info.date.trim() : "";
  const timeStr = typeof info.time === "string" ? info.time.trim() : "";
  if (dateStr) {
    const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
    const d = Date.parse(combined);
    if (!Number.isNaN(d)) return new Date(d);
  }

  return new Date();
}

function parseSlotTime(row: Record<string, unknown>, info: Record<string, unknown>): string {
  const details = asRecord(row.details);
  const slot = asRecord(details.slot);
  const add = asRecord(row.additional_info);
  const infoAdd = asRecord(info.additional_info as unknown);

  const start = (slot.start_time?.toString() ?? "").trim();
  const end = (slot.end_time?.toString() ?? "").trim();
  const slotWindow =
    start && end ? `${start} - ${end}` : start || "";

  return firstNonEmpty([
    slotWindow,
    details.booking_time?.toString(),
    details.preferred_date_time?.toString(),
    info.slot_time?.toString(),
    info.time?.toString(),
    info.slot?.toString(),
    add.collection_slot_time?.toString(),
    infoAdd.collection_slot_time?.toString(),
    add.slot_time?.toString(),
    row.slot_time?.toString(),
    row.time?.toString(),
    row.collection_slot_time?.toString(),
  ]);
}

export function friendlyWhenLine(row: Record<string, unknown>, info: Record<string, unknown>): string {
  const date = parseOngoingDate(row, info);
  const slotTime = parseSlotTime(row, info).trim();

  const today = new Date();
  const dayStart = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (dayStart(date) - dayStart(today)) / (24 * 60 * 60 * 1000),
  );

  const dateLabel =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

  return slotTime ? `${dateLabel} · ${slotTime}` : dateLabel;
}

export function visitTypeLabelFromRow(row: Record<string, unknown>): string | null {
  const raw = firstNonEmpty([row.visit_type?.toString(), row.visitType?.toString()]).trim();
  if (!raw) return null;
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) =>
      w.length === 0 ? "" : `${w.charAt(0)}${w.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

export function memberCountFromRow(row: Record<string, unknown>, info: Record<string, unknown>): number {
  const rootAdd = asRecord(row.additional_info);
  const infoAdd = asRecord(info.additional_info as unknown);
  const detailsObj = asRecord(row.details);

  const lists = [
    rootAdd.order_details,
    infoAdd.order_details,
    detailsObj.order_details,
  ];
  for (const d of lists) {
    if (Array.isArray(d)) {
      const valid = d.filter((x) => x && typeof x === "object").length;
      if (valid > 0) return valid;
    }
  }
  return 1;
}

function trimName(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t : null;
}

export function patientNameFromRow(
  row: Record<string, unknown>,
  info: Record<string, unknown>,
  memberCount: number,
): string {
  const u = asRecord(row.user);
  const userInfo = asRecord(row.user_info);
  const m = asRecord(row.member);
  const iu = asRecord(info.user as unknown);
  const im = asRecord(info.member as unknown);
  const patientObj = asRecord(info.patient as unknown);
  const detailsObj = asRecord(row.details);
  const details = asRecord(info.details as unknown);
  const add = asRecord(row.additional_info);

  const pRaw = info.patient;
  if (typeof pRaw === "string" && pRaw.trim()) return pRaw.trim();

  const candidates: Array<string | null> = [
    trimName(row.user_name),
    trimName(row.member_name),
    trimName(detailsObj.user_name),
    trimName(detailsObj.member_name),
    trimName(info.user_name),
    trimName(info.member_name),
    trimName(add.user_name),
    trimName(add.member_name),
    trimName(userInfo.name),
    trimName(u.name),
    trimName(iu.name),
    trimName(m.name),
    trimName(im.name),
    trimName(patientObj.name),
    trimName(patientObj.full_name),
    trimName(details.patient_name),
    trimName(asRecord(details.patient).name),
    trimName(add.patient_name),
    trimName(row.patient_name),
    trimName(row.patientName),
    trimName(info.patient_name),
    trimName(info.member_name),
    trimName(info.name),
    trimName(detailsObj.name),
    trimName(row.name),
  ];

  for (const c of candidates) {
    if (c) return c;
  }

  if (memberCount <= 1) {
    /* no secure storage in web — fall back */
  }
  return "Patient";
}

/** `OrderCategoryIcon` category keys — mirrors Dart `_orderTypeIconMap`. */
export function orderCategoryKeyFromDisplayCategory(name: string): string {
  switch (name) {
    case "Consultation":
      return "consultation";
    case "Lab Test":
      return "lab";
    case "Subscriptions":
      return "subscriptions";
    case "Pharmacy":
    case "Chronic":
      return "pharmacy";
    case "Dental":
      return "dental";
    case "Vision":
      return "vision";
    case "Vaccine":
      return "vaccine";
    case "Gym":
      return "gym";
    case "Mental Wellness":
      return "mental_wellness";
    case "Nutrition":
      return "nutrition";
    default:
      return "orders_all";
  }
}
