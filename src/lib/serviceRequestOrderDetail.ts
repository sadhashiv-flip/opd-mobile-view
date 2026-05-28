function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
    return null;
  }
  const s = String(v).trim();
  return s.length ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** patient_app `formatServiceRequestVisitTypeLabel`. */
export function formatServiceRequestVisitTypeLabel(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "—";
  const key = v.toUpperCase().replace(/-/g, "_");
  switch (key) {
    case "SELF_PICKUP":
    case "SELF_VISIT":
      return "Self visit";
    case "HOME_DELIVERY":
    case "HOME_VISIT":
      return "Home visit";
    case "HOME_SERVICE":
      return "Home service";
    default:
      return v.replaceAll("_", " ");
  }
}

function formatServiceRequestDateTimeHuman(raw: string | null | undefined): string {
  if (raw == null || !raw.trim()) return "—";
  const s = raw.trim();
  let d = Date.parse(s);
  if (Number.isNaN(d) && s.includes(" ") && !s.includes("T")) {
    d = Date.parse(s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T"));
  }
  if (Number.isNaN(d)) return s;
  const dt = new Date(d);
  const datePart = dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = dt.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

/** patient_app `formatServiceRequestPreferredSlot`. */
export function formatServiceRequestPreferredSlot(
  details: Record<string, unknown> | null | undefined,
): string {
  if (details == null) return "—";
  const slotRaw = details.slot;
  if (slotRaw != null && typeof slotRaw === "object" && !Array.isArray(slotRaw)) {
    const slot = slotRaw as Record<string, unknown>;
    const dateStr = str(slot.slot_date)?.trim() ?? "";
    const start = str(slot.start_time)?.trim() ?? "";
    const end = str(slot.end_time)?.trim() ?? "";
    if (dateStr) {
      let dateFmt = dateStr;
      try {
        const iso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`;
        const dt = new Date(iso);
        if (!Number.isNaN(dt.getTime())) {
          dateFmt = dt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        }
      } catch {
        /* keep raw */
      }
      if (start && end) return `${dateFmt} · ${start} – ${end}`;
      if (start) return `${dateFmt} · ${start}`;
      return dateFmt;
    }
    if (start || end) {
      if (start && end) return `${start} – ${end}`;
      return start || end || "—";
    }
  }
  const raw =
    str(details.preferred_date_time) ?? str(details.booking_time) ?? null;
  return formatServiceRequestDateTimeHuman(raw);
}

/** patient_app `_formatAddress` on `details.address`. */
export function formatServiceRequestAddress(raw: unknown): string {
  if (raw == null) return "—";
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : "—";
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return "—";
  const m = raw as Record<string, unknown>;
  const parts = [
    m.line_1,
    m.line1,
    m.line_2,
    m.line2,
    m.landmark,
    m.area,
    m.city,
    m.state,
    m.country,
    m.pincode,
    m.pin_code,
    m.pin,
  ]
    .map((e) => (e == null ? "" : String(e).trim()))
    .filter((s) => s.length > 0);
  const structured = parts.length > 0 ? parts.join(", ") : null;
  const display = str(m.display_address);
  if (structured && display) {
    return display.length > structured.length ? display : structured;
  }
  if (structured) return structured;
  if (display) return display;
  return "—";
}

function formatAddressFromUnknown(address: unknown): string {
  if (address == null) return "—";
  if (typeof address === "string") {
    const t = address.trim();
    return t.length > 0 ? t : "—";
  }
  return formatServiceRequestAddress(address);
}

/** Order summary “Address” row — patient_app `_formatAddress` / center display address. */
export function formatServiceRequestOrderSummaryAddress(
  info: Record<string, unknown> | null | undefined,
): string {
  if (info == null) return "—";
  const det = asRecord(info.details);
  if (det == null) return "—";
  return formatAddressFromUnknown(det.address);
}

/** Vaccine `details.request` list entries as bullet strings. */
export function parseServiceRequestRequestBullets(
  info: Record<string, unknown> | null | undefined,
): readonly string[] {
  if (info == null) return [];
  const det = asRecord(info.details);
  if (det == null) return [];
  const request = det.request;
  if (!Array.isArray(request) || request.length === 0) return [];
  const out: string[] = [];
  for (const item of request) {
    if (item == null) continue;
    const label = String(item).trim();
    if (label.length > 0) out.push(label);
  }
  return out;
}

export type ServiceRequestRiderUi = Readonly<{
  name: string;
  contact: string;
}>;

/** patient_app `showRiderCard` — `HOME_SERVICE` + `visitor_info` with name and contact. */
export function parseServiceRequestRider(
  info: Record<string, unknown> | null | undefined,
): ServiceRequestRiderUi | null {
  if (info == null) return null;
  const visit = (str(info.visit_type) ?? "").trim().toUpperCase();
  if (visit !== "HOME_SERVICE") return null;
  const det = asRecord(info.details);
  if (det == null) return null;
  const rider = asRecord(det.visitor_info) ?? asRecord(det.visitorInfo);
  if (rider == null) return null;
  const name = str(rider.name)?.trim() ?? "";
  const contact =
    str(rider.contact)?.trim() ||
    str(rider.phone)?.trim() ||
    str(rider.mobile)?.trim() ||
    "";
  if (!name || !contact) return null;
  return { name, contact };
}

export function serviceRequestScreenTitle(categoryKey: string): string {
  switch (categoryKey) {
    case "dental":
      return "Dental request";
    case "vision":
      return "Vision request";
    case "vaccine":
      return "Vaccine request";
    default:
      return "Service request";
  }
}

export function showServiceRequestSelfVisitCenter(
  info: Record<string, unknown> | null | undefined,
): boolean {
  if (info == null) return false;
  const visit = (str(info.visit_type) ?? "").trim().toUpperCase();
  if (visit !== "SELF_VISIT") return false;
  const det = asRecord(info.details);
  const center = det != null ? asRecord(det.center) : null;
  return center != null && Object.keys(center).length > 0;
}

/** patient_app `showRiderCard` — hide for statuses 0–4. */
export function showServiceRequestRiderCard(
  infoStatus: number | null | undefined,
  info: Record<string, unknown> | null | undefined,
): boolean {
  if (infoStatus != null && [0, 1, 2, 3, 4].includes(infoStatus)) return false;
  return parseServiceRequestRider(info) != null;
}

/** patient_app `showInvoiceSection` — `info.status != 0` and line items present. */
export function showServiceRequestInvoiceSection(
  infoStatus: number | null | undefined,
  lineItemCount: number,
): boolean {
  if (lineItemCount <= 0) return false;
  if (infoStatus == null) return true;
  return infoStatus !== 0;
}

/** patient_app `showPaymentsSection` — payment history when `payments` is non-empty. */
export function showServiceRequestPaymentsSection(paymentCount: number): boolean {
  return paymentCount > 0;
}

/**
 * patient_app `showCompletePaymentBar` — `info.status === 4` and
 * `info.additional_info.payment_required === true` (no separate Payment Summary card).
 */
export function showServiceRequestCompletePaymentBar(args: {
  readonly infoStatus: number | null | undefined;
  readonly paymentRequiredKeyPresent: boolean;
  readonly paymentRequired: boolean;
}): boolean {
  if (args.infoStatus !== 4) return false;
  return args.paymentRequiredKeyPresent && args.paymentRequired;
}

/** Flutter service request detail never uses a standalone “Payment Summary” card. */
export function showServiceRequestPaymentSummaryFallback(): boolean {
  return false;
}

/** patient_app `_statusLabel` on service request order detail. */
export function serviceRequestStatusLabel(infoStatus: number | null | undefined): string {
  const n = infoStatus == null || !Number.isFinite(infoStatus) ? null : Math.trunc(infoStatus);
  switch (n) {
    case 0:
      return "Waiting for confirmation";
    case 1:
      return "Completed";
    case 2:
      return "Cancelled";
    case 3:
      return "Confirm details";
    case 4:
      return "Payment pending";
    case 5:
      return "Booked";
    case 6:
      return "In progress";
    case 9:
      return "Expired";
    default:
      return "Pending";
  }
}

export type ServiceRequestStatusBannerTone =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral";

/** patient_app `_serviceRequestStatusStyle` → CSS modifier. */
export function serviceRequestStatusBannerTone(
  infoStatus: number | null | undefined,
): ServiceRequestStatusBannerTone {
  const n = infoStatus == null || !Number.isFinite(infoStatus) ? -1 : Math.trunc(infoStatus);
  if (n === 1 || n === 6) return "success";
  if (n === 2 || n === 9) return "error";
  if (n === 4) return "warning";
  if (n === 5 || n === 0 || n === 3) return "info";
  return "neutral";
}

export type ServiceRequestPatientRow = Readonly<{
  label: string;
  value: string;
}>;

/** patient_app `OrderPatientFields.from`. */
export function parseServiceRequestPatientRows(
  inv: Record<string, unknown>,
  info: Record<string, unknown>,
): readonly ServiceRequestPatientRow[] {
  const u = asRecord(inv.user) ?? {};
  const m = asRecord(inv.member) ?? {};
  const pick = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = u[k] ?? m[k] ?? info[k];
      if (v == null) continue;
      const s = String(v).trim();
      if (s.length > 0) return s;
    }
    return null;
  };

  const name = pick(["name", "patient_name"]) ?? "—";
  const phone = pick(["phone", "mobile"]);
  const email = pick(["email"]);
  const age = pick(["age"]);
  const gender = pick(["gender"]);
  const ageParts = [age, gender].filter((x): x is string => Boolean(x));
  const ageGender = ageParts.join(" · ");
  const vendor = pick([
    "hospital_name",
    "vendor_name",
    "clinic_name",
    "hospital",
    "clinic",
  ]);
  const location = pick(["location"]);

  const rows: ServiceRequestPatientRow[] = [{ label: "Patient Name", value: name }];
  if (phone) rows.push({ label: "Phone", value: phone });
  if (email) rows.push({ label: "Email", value: email });
  if (ageGender) rows.push({ label: "Age / Gender", value: ageGender });
  if (vendor) rows.push({ label: "Vendor", value: vendor });
  if (location) rows.push({ label: "Location", value: location });
  return rows;
}

export function resolveServiceRequestCreatedAtRaw(
  inv: Record<string, unknown>,
  info: Record<string, unknown>,
): string | null {
  return (
    str(info.createdAt) ??
    str(info.created_at) ??
    str(inv.createdAt) ??
    str(inv.created_at) ??
    str(inv.invoice_date) ??
    null
  );
}

/** patient_app `_formatOrderCreatedAt` (`dd MMM yyyy, hh:mm a`). */
export function formatServiceRequestCreatedAtDisplay(raw: string | null | undefined): string {
  if (raw == null || !raw.trim()) return "—";
  const s = raw.trim();
  let d = Date.parse(s);
  if (Number.isNaN(d) && s.includes(" ") && !s.includes("T")) {
    d = Date.parse(s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T"));
  }
  if (Number.isNaN(d)) return s;
  const dt = new Date(d);
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
