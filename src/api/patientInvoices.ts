import type { VirtualSpecialtySlotsState } from "@/api/consultationVirtual";
import { fetchConsultationReportPdfBlob, triggerConsultationReportPdfDownload } from "@/api/patientConsultationReport";
import { patientJson } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

/**
 * Query `type` for `GET /invoice` — align with backend `transaction_type` filters
 * (response uses values like `VACCINE`, `NUTRITION`, `MENTALWELLNESS`).
 */
/** Values sent as `type=` on `GET /invoice` — aligned with Flutter `OrdersController._categoryToApiType`. */
export const INVOICE_FILTER_TYPES = {
  all: null,
  consultation: "CONSULTATION",
  labTest: "LABTEST",
  subscriptions: "PLAN",
  pharmacy: "PHARMACY",
  dental: "DENTAL",
  vision: "VISION",
  vaccine: "VACCINE",
  gym: "GYM",
  mentalWellness: "MENTALWELLNESS",
  nutrition: "NUTRITION",
} as const;

export type InvoiceFilterId = keyof typeof INVOICE_FILTER_TYPES;

/** List + detail row badge tone; `info.status` 3 / 4 / 5 map to the last three. */
export type InvoiceOrderListStatusTone =
  | "completed"
  | "cancelled"
  | "expired"
  | "processing"
  | "other"
  | "confirmPending"
  | "paymentPending"
  | "upcoming";

export type InvoiceOrderRow = Readonly<{
  id: string;
  /**
   * `data.info.id` when present — canonical **`GET /invoice/:id`** lookup for lab partner orders (same as
   * {@link InvoiceDetailModel.consultationInfoId}); null when absent. Use for `/order/lab/:id` links.
   */
  infoId: string | null;
  categoryLabel: string;
  categoryKey: string;
  /** `#` + `data.info.id` when present; otherwise empty (no label). */
  orderIdLine: string;
  metaLine: string;
  statusTone: InvoiceOrderListStatusTone;
  statusLabel: string;
  isFree: boolean;
  amountFormatted: string | null;
  /** True when `transaction_type` is consultation and communication (from `info` or `data.info`) is ONLINE. */
  canJoinOnlineConsultation: boolean;
  /** Appointment id for {@link ROUTES.videoCall} (join/end/chat/feedback paths). */
  videoAppointmentId: string | null;
  /** Consultation list: channel chip next to `#info.id` (null for non-consultation). */
  consultationPlaceTag: "virtual" | "inPerson" | null;
}>;

export type InvoicesPageResult = Readonly<{
  items: readonly InvoiceOrderRow[];
  page: number;
  limit: number;
  hasMore: boolean;
}>;

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
    return null;
  }
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function firstArrayInRecord(rec: Record<string, unknown>): unknown[] | null {
  for (const key of ["invoices", "data", "items", "results", "orders", "list"] as const) {
    const a = rec[key];
    if (Array.isArray(a)) return a;
  }
  return null;
}

function extractArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const nested = firstArrayInRecord(root);
  if (nested) return nested;
  const d = root.data;
  if (Array.isArray(d)) return d;
  const inner = asRecord(d);
  if (inner) {
    const innerList = firstArrayInRecord(inner);
    if (innerList) return innerList;
  }
  return [];
}

function extractMeta(body: unknown): {
  page: number;
  limit: number;
  total: number | null;
  totalPages: number | null;
} {
  const root = asRecord(body);
  const page =
    num(root?.page) ??
    num(root?.current_page) ??
    num(asRecord(root?.pagination)?.page) ??
    1;
  const limit =
    num(root?.limit) ??
    num(root?.per_page) ??
    num(asRecord(root?.pagination)?.limit) ??
    20;
  const total =
    num(root?.total) ??
    num(root?.count) ??
    num(asRecord(root?.pagination)?.total) ??
    null;
  const totalPages =
    num(root?.total_pages) ??
    num(root?.pages) ??
    num(asRecord(root?.pagination)?.total_pages) ??
    null;
  return { page, limit, total, totalPages };
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatOrderDate(raw: string | null): string | null {
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
  if (iso) {
    const d = new Date(`${iso}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return raw;
}

function titleCaseStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower === "completed" || lower === "complete") return "Completed";
  if (lower === "processing" || lower === "in_progress" || lower === "in progress") {
    return "Processing";
  }
  if (lower === "cancelled" || lower === "canceled") return "Cancelled";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusToneFrom(raw: string | null): InvoiceOrderListStatusTone {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("complet")) return "completed";
  if (s.includes("process") || s.includes("pending") || s.includes("progress")) {
    return "processing";
  }
  if (s.includes("cancel")) return "cancelled";
  return "other";
}

/** `info` on the row or nested `data.info` (list payloads often wrap under `data`). */
function readInvoiceInfoObject(o: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(o.info);
  if (direct) return direct;
  const inv = asRecord(o.invoice);
  if (inv) {
    const fromInv = asRecord(inv.info);
    if (fromInv) return fromInv;
  }
  const data = asRecord(o.data);
  if (data) {
    const nested = asRecord(data.info);
    if (nested) return nested;
    const inv2 = asRecord(data.invoice);
    if (inv2) {
      const fromInv2 = asRecord(inv2.info);
      if (fromInv2) return fromInv2;
    }
  }
  return null;
}

function readInvoiceDataObject(o: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(o.data);
}

function normalizedTransactionKind(raw: string): string {
  return raw.trim().toUpperCase().replaceAll("_", "").replaceAll(/\s+/g, "");
}

function communicationFromInvoiceRow(o: Record<string, unknown>, info: Record<string, unknown> | null): string | null {
  const fromInfo = info ? str(info.communication) : null;
  if (fromInfo) return fromInfo;
  return str(o.communication);
}

function videoAppointmentIdFromRow(
  o: Record<string, unknown>,
  info: Record<string, unknown> | null,
  data: Record<string, unknown> | null,
): string | null {
  const add = asRecord(o.additional_info);
  const fromInfo = (rec: Record<string, unknown> | null) =>
    rec
      ? str(rec.appointment_id) ??
        str(rec.appointmentId) ??
        str(rec.booking_id) ??
        str(rec.bookingId) ??
        str(rec.reference_appointment_id) ??
        str(rec.referenceAppointmentId)
      : null;
  const infoId =
    info != null
      ? (() => {
          const id = str(info.id);
          return id && /^APP/i.test(id) ? id : null;
        })()
      : null;
  return (
    str(o.appointment_id) ??
    str(o.appointmentId) ??
    str(o.booking_id) ??
    str(o.bookingId) ??
    (data
      ? str(data.appointment_id) ??
        str(data.appointmentId) ??
        str(data.booking_id) ??
        str(data.bookingId)
      : null) ??
    fromInfo(info) ??
    infoId ??
    fromInfo(add)
  );
}

export function sortInvoiceOrderRowsByIdAsc(rows: readonly InvoiceOrderRow[]): InvoiceOrderRow[] {
  return [...rows].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }),
  );
}

/** Maps a service / transaction label to a stable UI category key (orders list, icons, URLs). */
export function categoryKeyFromLabel(label: string): string {
  const s = label.toLowerCase();
  if (s.includes("consult")) return "consultation";
  if (s.includes("lab")) return "lab";
  if (s.includes("pharmacy") || s.includes("pharma")) return "pharmacy";
  if (s.includes("dental")) return "dental";
  if (s.includes("vision")) return "vision";
  if (s.includes("vaccine")) return "vaccine";
  if (s.includes("gym")) return "gym";
  if (s.includes("mental") || (s.includes("wellness") && !s.includes("nutrition"))) {
    return "mental_wellness";
  }
  if (s.includes("nutrition") || s.includes("diet")) return "nutrition";
  return "other";
}

/**
 * Vision, dental, vaccine: same partner-detail UI (`info.details` + status 3) and
 * `PATCH service/request/confirm/:serviceId` with `{ status: 4 }` (not pharmacy).
 */
const SERVICE_REQUEST_PARTNER_DETAIL_CATEGORIES = new Set(["vision", "dental", "vaccine"]);

/** Pharmacy + vision/dental/vaccine: same pay preview/confirm APIs and payment `payment_required` resolution. */
export function isPartnerOrderPayFlowCategory(categoryKey: string): boolean {
  return categoryKey === "pharmacy" || SERVICE_REQUEST_PARTNER_DETAIL_CATEGORIES.has(categoryKey);
}

/** Maps API `transaction_type` (any casing / underscores) to UI label. */
function displayCategoryLabel(raw: string | null): string {
  if (!raw) return "Order";
  const k = raw.trim().toLowerCase().replaceAll("_", "").replaceAll(/\s+/g, "");
  const map: Record<string, string> = {
    consultation: "Consultation",
    labtest: "Lab Test",
    labtests: "Lab Test",
    pharmacy: "Pharmacy",
    dental: "Dental",
    vision: "Vision",
    vaccine: "Vaccine",
    gym: "Gym",
    gymoptin: "Gym",
    mentalwellness: "Mental Wellness",
    nutrition: "Nutrition",
  };
  if (map[k]) return map[k];
  const s = raw.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function deriveInvoiceStatus(o: Record<string, unknown>): {
  label: string;
  tone: InvoiceOrderListStatusTone;
} {
  const payment = (str(o.status) ?? "").toLowerCase();
  const order = (str(o.order_status) ?? str(o.orderStatus) ?? "").toLowerCase();

  if (
    order.includes("cancel") ||
    payment === "cancelled" ||
    payment === "canceled" ||
    payment === "failed"
  ) {
    return { label: "Cancelled", tone: "cancelled" };
  }

  if (payment === "paid" || payment === "completed" || order === "completed" || order === "delivered") {
    return { label: "Completed", tone: "completed" };
  }

  if (
    payment === "pending" ||
    payment === "processing" ||
    order === "pending" ||
    order === "processing" ||
    order === "in_progress"
  ) {
    return { label: "Processing", tone: "processing" };
  }

  const fallback = str(o.order_status) ?? str(o.status) ?? "";
  return {
    label: fallback ? titleCaseStatus(fallback) : "—",
    tone: statusToneFrom(fallback),
  };
}

/** Badge tone for list rows from `data.info.status` (consultation, pharmacy, vaccine, … when `info` is present). */
export function consultationInfoStatusOrderRowTone(status: unknown): InvoiceOrderListStatusTone {
  const raw = num(status);
  const n = raw == null || Number.isNaN(raw) ? null : Math.trunc(raw);
  if (n === 1) return "completed";
  if (n === 2) return "cancelled";
  if (n === 3) return "confirmPending";
  if (n === 4) return "paymentPending";
  if (n === 5) return "upcoming";
  return "processing";
}

/** Start of consultation slot in ms (virtual expiry / join windows); not for list display. */
function consultationSlotStartMsFromInfo(info: Record<string, unknown>): number | null {
  const add = asRecord(info.additional_info);
  const booking = add ? asRecord(add.booking_details) : null;
  const timeSlot = booking ? str(booking.time_slot) : null;
  if (timeSlot?.trim()) {
    const raw = timeSlot.trim().replace(" ", "T");
    const p = Date.parse(raw.length <= 10 ? `${raw}T12:00:00` : raw);
    return Number.isNaN(p) ? null : p;
  }
  const d = str(info.date)?.trim();
  const timePart = str(info.time)?.trim();
  if (d && timePart) {
    const iso = `${d}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
    const p = Date.parse(iso);
    return Number.isNaN(p) ? null : p;
  }
  if (d) {
    const iso = /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(0, 10)}T12:00:00` : d;
    const p = Date.parse(iso);
    return Number.isNaN(p) ? null : p;
  }
  return null;
}

function parseInvoicePricing(o: Record<string, unknown>): Pick<InvoiceOrderRow, "isFree" | "amountFormatted"> {
  const priceLabel = str(o.price_label);
  const freeExplicit =
    o.is_free === true ||
    o.free === true ||
    priceLabel?.toUpperCase() === "FREE";

  const netAmt = num(o.net_amount) ?? num(o.netAmount);
  const paidAmt = num(o.paid_amount) ?? num(o.paidAmount);
  const legacyAmount =
    num(o.amount) ??
    num(o.total) ??
    num(o.payable_amount) ??
    num(o.grand_total) ??
    num(o.price);

  let effectiveAmount: number | null = null;
  if (netAmt != null && netAmt > 0) {
    effectiveAmount = netAmt;
  } else if (paidAmt != null && paidAmt > 0) {
    effectiveAmount = paidAmt;
  } else if (legacyAmount != null && legacyAmount > 0) {
    effectiveAmount = legacyAmount;
  }

  const amountStr = str(o.amount);
  const explicitZeroInvoice =
    netAmt === 0 &&
    paidAmt === 0 &&
    (legacyAmount == null || legacyAmount === 0);
  const isFree =
    freeExplicit ||
    amountStr?.toLowerCase() === "free" ||
    explicitZeroInvoice;
  const amountFormatted =
    effectiveAmount != null && effectiveAmount > 0 ? formatInr(effectiveAmount) : null;

  return { isFree, amountFormatted };
}

function normalizeOne(v: unknown, index: number): InvoiceOrderRow | null {
  const root = asRecord(v);
  if (!root) return null;
  const dataRec = asRecord(root.data);
  const o =
    dataRec != null && !Array.isArray(root.data)
      ? {
          ...root,
          ...dataRec,
        }
      : root;

  const id =
    str(o.id) ??
    str(o.invoice_id) ??
    str(o.invoiceId) ??
    str(o.order_id) ??
    str(o.orderId) ??
    `invoice-${index}`;

  const typeRaw =
    str(o.transaction_type) ??
    str(o.transactionType) ??
    str(o.type) ??
    str(o.service_type) ??
    str(o.serviceType) ??
    str(o.category) ??
    str(o.order_type) ??
    str(o.orderType) ??
    "";

  const baseCategoryLabel = displayCategoryLabel(typeRaw || null);
  const categoryKey = categoryKeyFromLabel(baseCategoryLabel);

  const memberName =
    str(o.patient_name) ??
    str(o.patientName) ??
    str(o.member_name) ??
    str(o.memberName) ??
    str(o.user_name) ??
    str(o.customer_name) ??
    str(o.name) ??
    null;

  const dateRaw =
    str(o.invoice_date) ??
    str(o.invoiceDate) ??
    str(o.created_at) ??
    str(o.createdAt) ??
    str(o.order_date) ??
    str(o.orderDate) ??
    str(o.booked_at) ??
    str(o.date);

  const dateFmt = formatOrderDate(dateRaw);

  const infoObj = readInvoiceInfoObject(o);
  const dataObj = readInvoiceDataObject(o);
  const typeNorm = normalizedTransactionKind(typeRaw);
  const isConsultation = typeNorm === "CONSULTATION";
  const infoTypeNorm =
    infoObj != null
      ? normalizedTransactionKind(str(infoObj.type) ?? str(infoObj.service_type) ?? "")
      : "";
  /** Vision bookings may use `transaction_type: CONSULTATION` while `data.info.type` is `VISION`. */
  const isVisionInvoice = categoryKey === "vision" || infoTypeNorm === "VISION";

  let categoryLabel = baseCategoryLabel;
  if (isConsultation && infoObj != null) {
    categoryLabel = "Consultation";
  }

  const infoListId = infoObj != null ? str(infoObj.id) : null;
  const orderIdLine = infoListId?.trim() ? `#${infoListId.trim()}` : "";

  const comm = communicationFromInvoiceRow(o, infoObj);
  const commNorm = comm != null ? comm.trim().toUpperCase() : "";
  const isOnline = commNorm === "ONLINE";
  const consultationPlaceTag: InvoiceOrderRow["consultationPlaceTag"] =
    isConsultation && infoObj != null ? (isOnline ? "virtual" : "inPerson") : null;

  /** Numeric `data.info.status` when present — drives list badge for all services (same codes as consultation). */
  const infoStatusNum = infoObj != null ? num(infoObj.status) : null;
  const infoStatusTrunc =
    infoStatusNum != null && !Number.isNaN(infoStatusNum) ? Math.trunc(infoStatusNum) : null;

  const slotStartMs =
    isConsultation && infoObj != null && !isVisionInvoice
      ? consultationSlotStartMsFromInfo(infoObj)
      : null;
  const isExpiredVirtual =
    isConsultation &&
    !isVisionInvoice &&
    isOnline &&
    infoStatusTrunc === 5 &&
    slotStartMs != null &&
    Date.now() > slotStartMs + 10 * 60 * 1000;

  let statusLabel: string;
  let statusTone: InvoiceOrderRow["statusTone"];
  if (isExpiredVirtual) {
    statusLabel = "Expired";
    statusTone = "expired";
  } else if (infoObj != null && infoStatusTrunc !== null) {
    statusLabel = invoiceListStatusLabelFromInfoStatus(
      infoObj.status,
      isConsultation && !isVisionInvoice,
    );
    statusTone = consultationInfoStatusOrderRowTone(infoObj.status);
  } else {
    const d = deriveInvoiceStatus(o);
    statusLabel = d.label;
    statusTone = d.tone;
  }

  const { isFree, amountFormatted } = parseInvoicePricing(o);

  const videoAppointmentId = videoAppointmentIdFromRow(o, infoObj, dataObj);
  const canJoinOnlineConsultation =
    isConsultation &&
    !isVisionInvoice &&
    isOnline &&
    !isExpiredVirtual &&
    videoAppointmentId != null &&
    videoAppointmentId.length > 0 &&
    statusTone !== "cancelled";

  const createdAtRaw = str(o.createdAt) ?? str(o.created_at);
  const consultationCreatedLine =
    createdAtRaw != null ? formatOrderDateTime(createdAtRaw) : null;
  const consultationCreatedDisplay =
    consultationCreatedLine != null && consultationCreatedLine !== "—"
      ? consultationCreatedLine
      : null;

  const metaLines: string[] = [];
  if (isConsultation) {
    if (memberName != null && memberName.length > 0 && consultationCreatedDisplay != null) {
      metaLines.push(`${memberName} • ${consultationCreatedDisplay}`);
    } else if (memberName != null && memberName.length > 0) {
      metaLines.push(memberName);
    } else if (consultationCreatedDisplay != null) {
      metaLines.push(consultationCreatedDisplay);
    }
  } else {
    if (memberName != null && memberName.length > 0) {
      metaLines.push(dateFmt ? `${memberName} • ${dateFmt}` : memberName);
    } else if (dateFmt != null) {
      metaLines.push(dateFmt);
    }
  }
  const metaLine = metaLines.length > 0 ? metaLines.join("\n") : "—";

  const infoIdTrimmed = infoListId?.trim() ?? null;

  return {
    id,
    infoId: infoIdTrimmed && infoIdTrimmed.length > 0 ? infoIdTrimmed : null,
    categoryLabel,
    categoryKey,
    orderIdLine,
    metaLine,
    statusTone,
    statusLabel,
    isFree,
    amountFormatted,
    canJoinOnlineConsultation,
    videoAppointmentId,
    consultationPlaceTag,
  };
}

function buildInvoicePath(
  type: string | null | undefined,
  page: number,
  limit: number,
  userId?: string | null,
): string {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("page", String(page));
  if (type != null && type.length > 0) {
    q.set("type", type);
  }
  const uid = userId?.trim();
  if (uid) {
    q.set("user_id", uid);
  }
  return `invoice?${q.toString()}`;
}

/**
 * Paginated invoices from `GET /invoice?limit=&page=` with optional `type=`.
 */
export async function fetchInvoicesPage(opts: {
  type?: string | null;
  page?: number;
  limit?: number;
  /** When set, scopes invoices to this family member (`user_id` query) — same as Flutter orders. */
  userId?: string | null;
}): Promise<InvoicesPageResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const path = buildInvoicePath(opts.type ?? null, page, limit, opts.userId ?? null);
  const body = await patientJson<unknown>(path, { skipGlobalLoading: true });

  const items = extractArray(body)
    .map((v, i) => normalizeOne(v, i))
    .filter((x): x is InvoiceOrderRow => x != null);

  const meta = extractMeta(body);
  const len = items.length;
  let hasMore = false;
  if (meta.totalPages != null && meta.page != null) {
    hasMore = meta.page < meta.totalPages;
  } else if (meta.total != null) {
    hasMore = meta.page * meta.limit < meta.total;
  } else if (len >= limit) {
    hasMore = true;
  }

  return { items, page: meta.page, limit: meta.limit, hasMore };
}

// --- Single invoice (GET /invoice/:id) ---

export type InvoiceDetailBannerTone = "completed" | "processing" | "cancelled";

/** One product / service row (table) on the invoice detail screen. */
export type InvoiceDetailLineItem = Readonly<{
  productName: string;
  qty: number;
  /** List / MRP column when present (from line `additional_info.mrp` or list `price`). */
  mrpFormatted: string | null;
  unitPriceFormatted: string;
  lineTotalFormatted: string;
  /** From line `payment_required` / `additional_info.payment_required` when present. */
  paymentRequired: boolean;
}>;

/** One label/value row parsed from a payment’s `refunded` object. */
export type InvoiceRefundDetailLine = Readonly<{ label: string; value: string }>;

/** Parsed from `info.details` when {@link InvoiceDetailModel.categoryKey} is `gym`. */
export type InvoiceGymPackageDetails = Readonly<{
  packageName: string | null;
  packageCode: string | null;
  mrpAmount: number | null;
  payAmount: number | null;
  packageAmount: number | null;
  mrpFormatted: string | null;
  payAmountFormatted: string | null;
  packageAmountFormatted: string | null;
  validityValue: number | null;
  validityUnits: string | null;
  enableWallet: boolean | null;
  tncHtml: string | null;
}>;

export type InvoiceGymOrderDetailBlock = Readonly<{
  location: string | null;
  subscriptionId: string | null;
  package: InvoiceGymPackageDetails | null;
  enrolleeName: string | null;
  enrolleePhone: string | null;
  enrolleeEmail: string | null;
  personalEmail: string | null;
}>;

export type InvoicePaymentRow = Readonly<{
  /** Payment method label (e.g. netbanking, SUBSCRIPTION). */
  title: string;
  subtitle: string | null;
  amountFormatted: string;
  statusLabel: string | null;
  paymentSrc: string | null;
  paymentId: string | null;
  paymentType: string | null;
  /** Server note on the payment row (e.g. refund explanation). */
  paymentNote: string | null;
  /** Raw refunded amount from API (for UI checks). */
  amountRefunded: number;
  refundAmountFormatted: string | null;
  refundLines: readonly InvoiceRefundDetailLine[];
}>;

export type ConsultationAttachmentRow = Readonly<{
  label: string;
  url: string | null;
}>;

/** In-person / offline consultation blocks for order details (from `info` + `user`). */
export type ConsultationOrderPatientUi = Readonly<{
  phone: string | null;
  email: string | null;
  ageGenderLine: string | null;
}>;

export type ConsultationOrderBookingUi = Readonly<{
  scheduleDisplay: string | null;
  clinicName: string | null;
  doctorName: string | null;
  specialty: string | null;
  qualification: string | null;
  experienceLabel: string | null;
  addressLine: string | null;
  mapsUrl: string | null;
}>;

/** Pharmacy pickup / delivery block on order detail (from merged invoice + envelope). */
export type PharmacyOrderLocationCardUi = Readonly<{
  cardTitle: string;
  headerName: string | null;
  addressText: string | null;
  phoneText: string | null;
  mapsUrl: string | null;
}>;

/** Partner center on order detail (from `info` / `info.details.center`; shown for all partner `info.status` values). */
export type PharmacyOrderConfirmCenterUi = Readonly<{
  centerName: string | null;
  centerAddress: string | null;
  centerPhone: string | null;
  mapsUrl: string | null;
}>;

function pharmacyOrderConfirmCenterUiHasContent(c: PharmacyOrderConfirmCenterUi): boolean {
  const name = c.centerName?.trim() ?? "";
  const addr = c.centerAddress?.trim() ?? "";
  const phone = c.centerPhone?.trim() ?? "";
  const maps = c.mapsUrl?.trim() ?? "";
  return name.length > 0 || addr.length > 0 || phone.length > 0 || maps.length > 0;
}

/** One row from invoice `orders[]` on lab / LABTEST detail (Flutter `_LabSubOrderCard`). */
export type LabSubOrderDetailRow = Readonly<{
  id: string;
  categoryLabel: string;
  visitTypeDisplay: string | null;
  status: number;
  statusLabel: string;
  dateSlotLine: string | null;
  reschedulePolicyNote: string | null;
  showRescheduleButton: boolean;
  rescheduleCategory: "pathology" | "radiology";
  /** Last / pending `reschedule_reason` from the API when returned on the sub-order. */
  rescheduleReason: string | null;
  /** Human line for a pending or last requested slot change (nested `additional_info` or flat keys). */
  rescheduleSlotChangeDisplay: string | null;
  /** When a reschedule was applied or requested (`rescheduled_at`, etc.), formatted for display. */
  rescheduleAtDisplay: string | null;
  /** Optional count from API (`reschedule_count`, etc.). */
  rescheduleCountDisplay: string | null;
  /** Self-visit center from `orders[].additional_info.center` when applicable. */
  subOrderCenter: PharmacyOrderConfirmCenterUi | null;
  /** Extra line under center: collection date/time from sub-order `additional_info`. */
  subOrderCenterBookingTimeLine: string | null;
  /** `status === 3` and center present — confirm via `PATCH lab/order/confirm/:subOrderId`. */
  showConfirmSubOrderCenterButton: boolean;
  /** Pending requested slot change copy when `status === 3` and `requested` map exists. */
  requestedUpdateDisplay: string | null;
  riderName: string | null;
  riderContact: string | null;
}>;

/** Invoice line items grouped by `details[].user.id` — patient_app “Tests by patient”. */
export type LabPatientLineGroupUi = Readonly<{
  displayName: string;
  subtitle: string;
  lines: ReadonlyArray<Readonly<{ productName: string; priceDisplay: string }>>;
}>;

export type InvoiceDetailModel = Readonly<{
  id: string;
  bannerTone: InvoiceDetailBannerTone;
  bannerTitle: string;
  bannerSubtitle: string;
  orderIdDisplay: string;
  /** Same as list: Virtual / In-person chip next to appointment id when consultation. */
  consultationPlaceTag: InvoiceOrderRow["consultationPlaceTag"];
  /** `info.status` when consultation (`1` completed, `2` cancelled, …); null if absent. */
  consultationInfoStatus: number | null;
  /**
   * `info.id` when present — consultation appointment id, pharmacy medicine order id (`PM…`), etc.
   * Used with `PATCH …/appointment/cancel/:id` from the order detail screen when cancellation is allowed.
   */
  consultationInfoId: string | null;
  /** `#` + {@link consultationInfoId} for display as the canonical order reference on order detail. */
  infoOrderIdFormatted: string | null;
  /** Display label for `info.visit_type` (falls back to root `visit_type` on merged payloads). */
  serviceVisitTypeLabel: string | null;
  /** Appointment id for `POST /upload` (`ref_id`) — from invoice `additional_info` / `info` when set, else `info.id`. */
  consultationUploadRefId: string | null;
  /**
   * Consultation: `info` exists, `info.additional_info` has own property `payment_required`, and it is strictly `true`.
   */
  consultationPaymentRequired: boolean;
  /** `info.status` when an `info` block exists (e.g. pharmacy medicine order `4` = pending payment). */
  serviceInfoStatus: number | null;
  /**
   * Same rule as {@link dataAdditionalInfoPaymentRequired}: `info.additional_info.payment_required`
   * key present and value `true` (order detail pay CTA uses this with {@link dataAdditionalInfoPaymentRequiredKeyPresent}).
   */
  infoPaymentRequired: boolean;
  /** `info.additional_info` includes own property `payment_required` (used with {@link dataAdditionalInfoPaymentRequired}). */
  dataAdditionalInfoPaymentRequiredKeyPresent: boolean;
  /** Strict `true` only when {@link dataAdditionalInfoPaymentRequiredKeyPresent} and `payment_required === true`. */
  dataAdditionalInfoPaymentRequired: boolean;
  /**
   * Lab only: invoice `orders` is a non-empty array and every entry has `status === 4` (matches Flutter
   * `showCompletePaymentBar` / `subOrders`). Always `false` for other categories.
   */
  labSubOrdersAllPendingPayment: boolean;
  /** Parsed `net_amount` / payable number for UI logic (e.g. pay CTA). */
  netPayAmount: number;
  /** `transaction_type` consultation — drives order-details layout. */
  isConsultationOrder: boolean;
  /** From `user` on the invoice payload when present (consultation, pharmacy, etc.). */
  consultationPatient: ConsultationOrderPatientUi | null;
  consultationBooking: ConsultationOrderBookingUi | null;
  /** From `info.doctor` for virtual rows (pending or completed); visit card uses offline booking only. */
  consultationOrderDoctor: ConsultationDoctorCard | null;
  /** From `info.attachments` when `info` is present (consultation, pharmacy, etc.). */
  consultationAttachments: readonly ConsultationAttachmentRow[];
  /** From `info.reports` for consultation invoices only. */
  consultationReports: readonly ConsultationAttachmentRow[];
  serviceTypeLabel: string;
  categoryKey: string;
  orderDateTimeDisplay: string;
  statusLabel: string;
  statusValueTone: InvoiceOrderRow["statusTone"];
  patientName: string;
  /**
   * Member/patient the service was booked for — prefers `info` / nested booking patient fields over account `user_name`.
   * Use for success screens & “Booked for” copy.
   */
  bookedForName: string;
  vendorName: string;
  /** Pharmacy pickup/delivery; vision/dental/vaccine **HOME_VISIT** user address from `info.details.address`. */
  pharmacyOrderLocation: PharmacyOrderLocationCardUi | null;
  /**
   * True when partner/pharmacy/lab order `info.status === 3` (user must confirm details).
   * Requested items, address, and center blocks render for all statuses — only the confirm CTA uses this flag.
   * Confirm: `PATCH medicine/order/confirm/:id` (pharmacy), `PATCH service/request/confirm/:info.id` (vision/dental/vaccine),
   * or `PATCH lab/order/confirm/:serviceId` (lab).
   */
  pharmacyAwaitingDetailConfirmation: boolean;
  /** Pharmacy: `additional_info.time_slot`; vision/dental/vaccine: `info.details.slot` / `booking_time`. */
  pharmacyPreferredSlotDisplay: string | null;
  /**
   * Lab only: `info.additional_info.requested.collection_date` + `collection_slot_time` when present
   * and different from the assigned slot (`pharmacyPreferredSlotDisplay` for lab).
   */
  labBookingRequestedDisplay: string | null;
  /**
   * Lab invoice `orders[]` sub-rows for collection bookings (Flutter `subOrders` cards).
   */
  labSubOrders: readonly LabSubOrderDetailRow[];
  /** `info.address.id` when present — required for reschedule slot fetch and PATCH body. */
  labCollectionAddressId: string | null;
  /** `info.source` (or fallbacks) — vendor code for diagnostics slots when rescheduling. */
  labRescheduleVendorCode: string | null;
  /** `#` + invoice id for “Order summary” (Flutter lab overview). */
  labInvoiceReferenceDisplay: string | null;
  /** `#` + `additional_info.lab_booking_id` when present. */
  labBookingReferenceDisplay: string | null;
  /** Optional `info.statusText` / `status_text` from API. */
  labInfoStatusTextLine: string | null;
  labTrackingUrl: string | null;
  labReportUrl: string | null;
  /** Shown on status banner when status is cancelled (Flutter). */
  labCancellationReason: string | null;
  /**
   * Home / pickup collection address — only when visit type is not self-visit-at-center-only.
   * Patient_app shows this as “Collection address”, separate from patient demographics.
   */
  labCollectionAddressCard: PharmacyOrderLocationCardUi | null;
  /** Non-empty when invoice `details` lines include per-member `user` — “Tests by patient”. */
  labPatientTestsByMember: readonly LabPatientLineGroupUi[];
  /** Uploaded prescription files from `info.additional_info.prescriptions`. */
  labUploadedPrescriptions: readonly ConsultationAttachmentRow[];
  /** Pharmacy: `info.additional_info.center`; vision/dental/vaccine: `info.details.center`. */
  pharmacyConfirmCenter: PharmacyOrderConfirmCenterUi | null;
  /** `info.details.alternate_phone` / `alternatePhone` when present (any order type with an `info` block). */
  infoDetailsAlternatePhone: string | null;
  /** Vaccine: `info.details.conditions` when set. */
  infoDetailsConditions: string | null;
  /** Vaccine: `info.details.note` when set. */
  infoDetailsNote: string | null;
  lineItems: readonly InvoiceDetailLineItem[];
  /** Sum of line totals (qty × unit) before discount, fees (+), and wallet. */
  subTotalFormatted: string;
  discountFormatted: string | null;
  collectionFeeFormatted: string | null;
  /** From `data.additional_info.processing_fee` / `processingFee` when present (shown separately from collection/convenience). */
  processingFeeFormatted: string | null;
  /** From `additional_info.delivery_charges` when present (e.g. pharmacy home delivery). */
  deliveryChargesFormatted: string | null;
  walletDebitFormatted: string | null;
  /** INR from wallet toward this invoice (same basis as {@link walletDebitFormatted}); `0` when unused. */
  walletDebitAmount: number;
  netPayFormatted: string;
  payments: readonly InvoicePaymentRow[];
  /**
   * Mental wellness / nutrition: `info.status === 5` and session start &gt; 60 minutes away
   * (same rule as Flutter `WellnessOrderDetailController.canCancel`).
   */
  wellnessSessionCancelAllowed: boolean;
  /** Gym-only: enrolment location, package meta, enrollee contacts from `info.details`. */
  gymOrderDetail: InvoiceGymOrderDetailBlock | null;
}>;

const LINE_ITEM_ARRAY_KEYS = [
  "items",
  "line_items",
  "invoice_items",
  "order_items",
  "services",
  "tests",
  "details",
  "cart_items",
  "products",
] as const;

function formatOrderDateTime(raw: string | null): string {
  if (!raw) return "—";
  const t = Date.parse(raw);
  if (Number.isNaN(t)) {
    const d = formatOrderDate(raw);
    return d ?? raw;
  }
  const d = new Date(t);
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

const INVOICE_ROOT_MERGE_KEYS = [
  "discount",
  "payments",
  "additional_info",
  "net_amount",
  "netAmount",
  "paid_amount",
  "paidAmount",
  "invoice_date",
  "invoiceDate",
  "createdAt",
  "created_at",
  "status",
  "order_status",
  "orderStatus",
  "transaction_type",
  "transactionType",
] as const;

/** Preserved on nested merge so pharmacy pay gate reads the order envelope’s `additional_info` from `GET /invoice/:id`. */
const FH_ENVELOPE_ADDITIONAL_INFO_KEY = "__FH_DATA_ADDITIONAL_INFO__";

/**
 * When `GET /invoice/:id` returns `data.invoice`, merge the inner invoice row with the outer `data`
 * envelope (address, visit_type, vendor_details, `data.additional_info`, etc.) so normalization
 * sees line items and envelope fields on one object.
 */
function mergeNestedEnvelopeDataWithInvoice(
  envelope: Record<string, unknown>,
  invoice: Record<string, unknown>,
): Record<string, unknown> {
  const envAdd = asRecord(envelope.additional_info);
  const invAdd = asRecord(invoice.additional_info);
  const mergedAdditional: Record<string, unknown> = {
    ...(invAdd ?? {}),
    ...(envAdd ?? {}),
  };
  const merged: Record<string, unknown> = { ...invoice, ...envelope };
  merged[FH_ENVELOPE_ADDITIONAL_INFO_KEY] = envelope.additional_info;
  merged.additional_info = Object.keys(mergedAdditional).length > 0 ? mergedAdditional : merged.additional_info;
  const resolvedInfo = asRecord(envelope.info) ?? asRecord(invoice.info);
  if (resolvedInfo != null) merged.info = resolvedInfo;
  merged.user = invoice.user ?? envelope.user ?? merged.user;
  merged.details = invoice.details ?? envelope.details ?? merged.details;
  return merged;
}

/**
 * Order-level `data.additional_info` from the live invoice response (never merged with
 * `invoice.additional_info`), used only for pharmacy payment gating.
 */
function envelopeDataAdditionalInfoForPaymentGate(o: Record<string, unknown>): Record<string, unknown> | null {
  const stashed = o[FH_ENVELOPE_ADDITIONAL_INFO_KEY];
  if (stashed != null && typeof stashed === "object" && !Array.isArray(stashed)) {
    return stashed as Record<string, unknown>;
  }
  const nestedData = asRecord(o.data);
  if (nestedData != null) {
    const fromNested = asRecord(nestedData.additional_info);
    if (fromNested != null) return fromNested;
  }
  return asRecord(o.additional_info);
}

function tryMergeInvoiceFromLineItemsArray(
  root: Record<string, unknown>,
  data: unknown[],
): Record<string, unknown> | null {
  const first = asRecord(data[0]);
  if (first == null) return null;
  const hasProductShape =
    str(first.product_name) != null ||
    str(first.productName) != null ||
    str(first.invoice_id) != null;
  if (!hasProductShape) return null;
  const merged: Record<string, unknown> = { items: data };
  for (const k of INVOICE_ROOT_MERGE_KEYS) {
    if (root[k] !== undefined) merged[k] = root[k];
  }
  if (merged.user == null && first.user != null) {
    merged.user = first.user;
  }
  const inv = str(first.invoice_id);
  if (inv != null) merged.invoice_id = inv;
  return merged;
}

/**
 * Resolves the primary payload node for `GET /invoice/:id` across common HTTP wrapper shapes
 * (`data`, `result.data`, `payload.data`, `response.data`) — whatever the API returns at runtime.
 */
function resolveSingleInvoiceDataNode(root: Record<string, unknown>): unknown {
  const fromResult = asRecord(root.result)?.data;
  const fromPayload = asRecord(root.payload)?.data;
  const fromResponse = asRecord(root.response)?.data;
  if (root.data !== undefined && root.data !== null) return root.data;
  if (fromResult !== undefined && fromResult !== null) return fromResult;
  if (fromPayload !== undefined && fromPayload !== null) return fromPayload;
  if (fromResponse !== undefined && fromResponse !== null) return fromResponse;
  return undefined;
}

function extractInvoicePayload(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  if (!root) return null;
  const data = resolveSingleInvoiceDataNode(root);
  if (Array.isArray(data) && data.length > 0) {
    const merged = tryMergeInvoiceFromLineItemsArray(root, data);
    if (merged != null) return merged;
  }
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const inv = asRecord(d.invoice);
    if (inv != null) {
      return mergeNestedEnvelopeDataWithInvoice(d, inv);
    }
    return d;
  }
  const inv = root.invoice ?? root.result ?? root.payload;
  const rec = asRecord(inv);
  if (rec) return rec;
  if (str(root.id) != null || str(root.transaction_type) != null) {
    return root;
  }
  return null;
}

function pushLineArraysFromRecord(out: unknown[], rec: Record<string, unknown>): void {
  for (const key of LINE_ITEM_ARRAY_KEYS) {
    const a = rec[key];
    if (Array.isArray(a)) {
      out.push(...a);
    }
  }
}

function collectLineItemArrays(o: Record<string, unknown>): unknown[] {
  const out: unknown[] = [];
  pushLineArraysFromRecord(out, o);
  const info = asRecord(o.info);
  if (info) {
    pushLineArraysFromRecord(out, info);
  }
  const add = asRecord(o.additional_info);
  if (add) {
    pushLineArraysFromRecord(out, add);
  }
  return out;
}

type ParsedLineRow = Readonly<{
  productName: string;
  qty: number;
  mrp: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  dedupeKey: string;
  paymentRequired: boolean;
}>;

function truthyLinePaymentRequired(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function lineRecordPaymentRequired(o: Record<string, unknown>): boolean {
  if (truthyLinePaymentRequired(o.payment_required ?? o.paymentRequired)) return true;
  const add = asRecord(o.additional_info);
  return add != null && truthyLinePaymentRequired(add.payment_required ?? add.paymentRequired);
}

function parseDetailLineItem(v: unknown, index: number): ParsedLineRow | null {
  const o = asRecord(v);
  if (!o) return null;

  const add = asRecord(o.additional_info);
  const mrpFromAdd = add ? num(add.mrp) : null;
  const paymentRequired = lineRecordPaymentRequired(o);

  const productName =
    str(o.product_name) ??
    str(o.productName) ??
    str(o.name) ??
    str(o.title) ??
    str(o.service_name) ??
    str(o.serviceName) ??
    str(o.test_name) ??
    str(o.testName) ??
    str(o.description) ??
    str(o.item_name) ??
    `Item ${index + 1}`;

  const qtyRaw = num(o.qty);
  const qty = qtyRaw != null && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;

  const offerPrice = num(o.offer_price) ?? num(o.offerPrice);
  const price = num(o.price);
  const unitPrice = offerPrice ?? price ?? mrpFromAdd;
  const mrp = mrpFromAdd ?? price ?? null;

  const hasProductFields = str(o.product_name) != null || str(o.productName) != null;
  if (hasProductFields) {
    const lineTotal = unitPrice == null ? null : unitPrice * qty;
    const dedupeKey = str(o.id) ?? `${productName}:${qty}:${unitPrice ?? "x"}`;
    return { productName, qty, mrp, unitPrice, lineTotal, dedupeKey, paymentRequired };
  }

  const legacyUnit =
    unitPrice ??
    num(o.amount) ??
    num(o.net_amount) ??
    num(o.netAmount) ??
    num(o.total) ??
    num(o.payable);
  const dedupeKey = str(o.id) ?? `${productName}:${legacyUnit ?? "x"}`;
  return {
    productName,
    qty: 1,
    mrp: legacyUnit,
    unitPrice: legacyUnit,
    lineTotal: legacyUnit,
    dedupeKey,
    paymentRequired,
  };
}

function bannerCopy(tone: InvoiceDetailBannerTone): { title: string; subtitle: string } {
  switch (tone) {
    case "completed":
      return {
        title: "Order Completed",
        subtitle: "This order has been completed successfully",
      };
    case "cancelled":
      return {
        title: "Order Cancelled",
        subtitle: "This order was cancelled",
      };
    default:
      return {
        title: "Order in progress",
        subtitle: "We're processing this order",
      };
  }
}

/**
 * Order-detail banner title = {@link consultationInfoStatusLabelOffline} (`info.status` codes 1–5 + default).
 * Subtitle is a short line matched to that status.
 * Vision + status `5` uses the same “Confirmed” treatment as other non-consultation services.
 */
export function consultationInfoStatusBannerCopy(
  status: unknown,
  opts?: Readonly<{ isVisionOrder?: boolean }>,
): { title: string; subtitle: string } {
  const raw = num(status);
  const n = raw == null || Number.isNaN(raw) ? null : Math.trunc(raw);
  if (opts?.isVisionOrder === true && n === 5) {
    return {
      title: "Confirmed",
      subtitle: "Your vision booking is confirmed",
    };
  }
  const title = consultationInfoStatusLabelOffline(status);
  switch (n) {
    case 1:
      return { title, subtitle: "Your consultation is complete" };
    case 2:
      return { title, subtitle: "This appointment was cancelled" };
    case 3:
      return { title, subtitle: "Please review and confirm the updates" };
    case 4:
      return { title, subtitle: "Complete payment to continue with this booking" };
    case 5:
      return { title, subtitle: "Your appointment is coming up" };
    default:
      return { title, subtitle: "We're updating this appointment" };
  }
}

function mapStatusToneToBanner(tone: InvoiceOrderListStatusTone): InvoiceDetailBannerTone {
  if (tone === "completed") return "completed";
  if (tone === "cancelled" || tone === "expired") return "cancelled";
  return "processing";
}

/**
 * `data.info.status` labels (codes 1–5 + default) — used for consultation order-detail banner and list rows.
 * On the orders list, status `5` is "Confirmed" except for **doctor consultation** (not Vision). Vision may use
 * {@link invoiceListStatusLabelFromInfoStatus} with `showConsultationStyleStatus5Label` = false when `info.type` is VISION.
 */
export function consultationInfoStatusLabelOffline(status: unknown): string {
  const raw = num(status);
  const n = raw == null || Number.isNaN(raw) ? null : Math.trunc(raw);
  switch (n) {
    case 1:
      return "Completed";
    case 2:
      return "Cancelled";
    case 3:
      return "Confirm Changes";
    case 4:
      return "Payment pending";
    case 5:
      return "Upcoming Appointment";
    default:
      return "Pending";
  }
}

/**
 * Orders list: `info.status === 5` → "Confirmed" unless this is doctor consultation (`showConsultationStyleStatus5Label`).
 * Vision uses `showConsultationStyleStatus5Label === false` even when `transaction_type` is CONSULTATION.
 */
function invoiceListStatusLabelFromInfoStatus(
  infoStatus: unknown,
  showConsultationStyleStatus5Label: boolean,
): string {
  const raw = num(infoStatus);
  const n = raw == null || Number.isNaN(raw) ? null : Math.trunc(raw);
  if (n === 5 && !showConsultationStyleStatus5Label) return "Confirmed";
  return consultationInfoStatusLabelOffline(infoStatus);
}

function toneFromConsultationInfoStatus(status: unknown): InvoiceOrderListStatusTone {
  return consultationInfoStatusOrderRowTone(status);
}

function detailPatientName(o: Record<string, unknown>): string {
  const direct =
    str(o.patient_name) ??
    str(o.patientName) ??
    str(o.member_name) ??
    str(o.memberName) ??
    str(o.user_name) ??
    str(o.customer_name) ??
    str(o.name);
  if (direct) return direct;
  const user = asRecord(o.user);
  if (user) {
    const n = str(user.name) ?? str(user.full_name) ?? str(user.fullName);
    if (n) return n;
  }
  const info = asRecord(o.info);
  if (!info) return "—";
  return (
    str(info.patient_name) ?? str(info.patientName) ?? str(info.name) ?? "—"
  );
}

/** Member/patient the booking is for — prefers `info.patient_name` / `info.name` before invoice root `user_name`. */
function bookedForNameFromInvoice(o: Record<string, unknown>, patientNameFallback: string): string {
  const info = asRecord(o.info);
  const fromInfo =
    info != null
      ? str(info.patient_name) ??
        str(info.patientName) ??
        str(info.member_name) ??
        str(info.memberName) ??
        str(info.name)
      : null;
  if (fromInfo?.trim()) return fromInfo.trim();
  const add = info != null ? asRecord(info.additional_info) : null;
  const booking = add != null ? asRecord(add.booking_details) : null;
  const fromNested =
    (booking != null ? str(booking.patient_name) ?? str(booking.member_name) : null) ??
    (add != null ? str(add.patient_name) ?? str(add.member_name) : null);
  if (fromNested?.trim()) return fromNested.trim();
  return patientNameFallback.trim() || "—";
}

function detailVendorName(o: Record<string, unknown>): string {
  const direct =
    str(o.vendor_name) ??
    str(o.vendorName) ??
    str(o.provider_name) ??
    str(o.lab_name) ??
    str(o.clinic_name) ??
    str(o.hospital_name) ??
    str(o.center_name);
  if (direct) return direct;
  const vd = asRecord(o.vendor_details);
  if (vd) {
    const n = str(vd.name);
    if (n) return n;
  }
  const info = asRecord(o.info);
  if (!info) return "—";
  return (
    str(info.vendor_name) ?? str(info.vendorName) ?? str(info.provider_name) ?? "—"
  );
}

function buildDetailLineItems(o: Record<string, unknown>): {
  lineItems: InvoiceDetailLineItem[];
  lineSum: number;
} {
  const rawLines = collectLineItemArrays(o);
  const parsedLines: ParsedLineRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawLines.length; i++) {
    const pl = parseDetailLineItem(rawLines[i], i);
    if (!pl) continue;
    if (seen.has(pl.dedupeKey)) continue;
    seen.add(pl.dedupeKey);
    parsedLines.push(pl);
  }
  const lineItems: InvoiceDetailLineItem[] = parsedLines.map((pl) => ({
    productName: pl.productName,
    qty: pl.qty,
    mrpFormatted: pl.mrp == null ? null : formatInr(pl.mrp),
    unitPriceFormatted: pl.unitPrice == null ? "—" : formatInr(pl.unitPrice),
    lineTotalFormatted: pl.lineTotal == null ? "—" : formatInr(pl.lineTotal),
    paymentRequired: pl.paymentRequired,
  }));
  const lineSum = parsedLines.reduce((s, pl) => s + (pl.lineTotal ?? 0), 0);
  return { lineItems, lineSum };
}

function invoiceDiscountAmount(o: Record<string, unknown>): number {
  return num(o.discount) ?? num(o.discount_amount) ?? num(o.discountAmount) ?? 0;
}

function invoiceCollectionFeeAmount(o: Record<string, unknown>): number {
  const add = asRecord(o.additional_info);
  const fromAdd = add
    ? num(add.collection_fee) ??
      num(add.collectionFee) ??
      num(add.convenience_fee) ??
      num(add.convenienceFee)
    : null;
  return fromAdd ?? num(o.collection_fee) ?? num(o.collectionFee) ?? 0;
}

/** `data.additional_info.processing_fee` (merged root or envelope `data.additional_info`). */
function invoiceProcessingFeeAmount(o: Record<string, unknown>): number {
  const read = (layer: Record<string, unknown> | null): number => {
    if (layer == null) return 0;
    const n = num(layer.processing_fee) ?? num(layer.processingFee);
    return n != null && !Number.isNaN(n) && n > 0 ? n : 0;
  };
  const merged = read(asRecord(o.additional_info));
  if (merged > 0) return merged;
  return read(envelopeDataAdditionalInfoForPaymentGate(o));
}

function invoiceDeliveryChargesAmount(o: Record<string, unknown>): number {
  const add = asRecord(o.additional_info);
  if (!add) return 0;
  return num(add.delivery_charges) ?? num(add.deliveryCharges) ?? 0;
}

function humanizeRefundKey(key: string): string {
  return key
    .replaceAll("_", " ")
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function formatRefundDetailValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && !Number.isNaN(v)) return formatInr(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v.length ? v : "—";
  if (Array.isArray(v)) return v.map((x) => formatRefundDetailValue(x)).join(", ");
  const inner = asRecord(v);
  if (inner) {
    return Object.entries(inner)
      .filter(([, val]) => val != null && val !== "")
      .map(([k, val]) => `${humanizeRefundKey(k)}: ${formatRefundDetailValue(val)}`)
      .join("; ");
  }
  try {
    return JSON.stringify(v);
  } catch {
    return "—";
  }
}

function parseRefundedObject(refunded: Record<string, unknown>): readonly InvoiceRefundDetailLine[] {
  const entries = Object.entries(refunded).filter(
    ([, v]) => v != null && v !== "" && v !== undefined,
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => ({
    label: humanizeRefundKey(k),
    value: formatRefundDetailValue(v),
  }));
}

function parseInvoicePayments(o: Record<string, unknown>): InvoicePaymentRow[] {
  const arr = o.payments;
  if (!Array.isArray(arr)) return [];
  const out: InvoicePaymentRow[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = asRecord(arr[i]);
    if (!r) continue;
    const amount =
      num(r.amount) ??
      num(r.paid_amount) ??
      num(r.paidAmount) ??
      num(r.value) ??
      0;
    const paymentSrc =
      str(r.payment_src) ?? str(r.paymentSrc) ?? str(r.payment_source) ?? null;
    const paymentId = str(r.id) ?? str(r.payment_id) ?? str(r.paymentId) ?? null;
    const paymentType = str(r.type) ?? str(r.payment_type) ?? str(r.paymentType) ?? null;
    const title =
      str(r.payment_mode) ??
      str(r.paymentMode) ??
      str(r.method) ??
      str(r.payment_method) ??
      str(r.paymentMethod) ??
      paymentSrc ??
      str(r.mode) ??
      str(r.gateway) ??
      `Payment ${i + 1}`;
    const paymentNote = str(r.note) ?? str(r.remark) ?? null;
    const statusLabel =
      str(r.status) ?? str(r.payment_status) ?? str(r.paymentStatus) ?? null;
    const ref =
      str(r.transaction_id) ??
      str(r.transactionId) ??
      str(r.reference) ??
      str(r.razorpay_payment_id) ??
      str(r.razorpay_order_id) ??
      null;
    const whenRaw = formatOrderDateTime(str(r.created_at) ?? str(r.createdAt) ?? str(r.date) ?? null);
    const whenPart = whenRaw === "—" ? null : whenRaw;
    /** Ref + date only — status is shown once via {@link InvoicePaymentRow.statusLabel}. */
    const subtitleParts = [ref, whenPart].filter((x): x is string => x != null && x.length > 0);
    const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null;

    const amountRefunded = num(r.amount_refunded) ?? num(r.amountRefunded) ?? 0;
    const refundedRec = asRecord(r.refunded);
    const refundLines =
      amountRefunded > 0 && refundedRec != null ? parseRefundedObject(refundedRec) : [];
    const refundAmountFormatted = amountRefunded > 0 ? formatInr(amountRefunded) : null;

    out.push({
      title,
      subtitle,
      amountFormatted: formatInr(amount),
      statusLabel,
      paymentSrc,
      paymentId,
      paymentType,
      paymentNote,
      amountRefunded,
      refundAmountFormatted,
      refundLines,
    });
  }
  return out;
}

function resolveDetailSubtotal(o: Record<string, unknown>, lineSum: number): number {
  const fromFields =
    num(o.sub_total) ??
    num(o.subtotal) ??
    num(o.gross_amount) ??
    num(o.gross_total) ??
    num(o.mrp_total);
  if (fromFields != null) return fromFields;
  if (lineSum > 0) return lineSum;
  return (
    num(o.net_amount) ??
    num(o.netAmount) ??
    num(o.paid_amount) ??
    num(o.paidAmount) ??
    0
  );
}

function resolveDetailWallet(o: Record<string, unknown>): number | null {
  const fromRoot =
    num(o.wallet_amount) ??
    num(o.walletAmount) ??
    num(o.from_wallet) ??
    num(o.fromWallet) ??
    num(o.wallet_debit) ??
    num(o.walletDebit) ??
    num(o.paid_from_wallet) ??
    num(o.paidFromWallet) ??
    num(o.discount_wallet) ??
    num(o.opd_paid_amount) ??
    num(o.opdPaidAmount) ??
    null;
  if (fromRoot != null && fromRoot > 0) return fromRoot;
  const info = readInvoiceInfoObject(o);
  const add = info ? asRecord(info.additional_info) : null;
  if (add) {
    const nested =
      num(add.wallet_amount) ??
      num(add.wallet_debit) ??
      num(add.opd_paid_amount) ??
      num(add.opdPaidAmount) ??
      null;
    if (nested != null && nested > 0) return nested;
  }
  return fromRoot;
}

function resolveDetailNetPay(
  o: Record<string, unknown>,
  itemsTotal: number,
  discountNum: number,
  collectionFeeNum: number,
  deliveryChargesNum: number,
  walletNum: number | null,
): number {
  const explicit =
    num(o.net_pay) ??
    num(o.netPay) ??
    num(o.payable_amount) ??
    num(o.amount_due) ??
    num(o.net_amount) ??
    num(o.netAmount);
  if (explicit != null) return explicit;
  const afterDiscountAndFee =
    itemsTotal - discountNum + collectionFeeNum + deliveryChargesNum;
  return afterDiscountAndFee - (walletNum ?? 0);
}

function consultationAttachmentRowFromRecord(
  r: Record<string, unknown>,
  fallbackLabel: string,
): ConsultationAttachmentRow {
  const label =
    str(r.name) ??
    str(r.file_name) ??
    str(r.fileName) ??
    str(r.title) ??
    str(r.document_name) ??
    str(r.original_name) ??
    fallbackLabel;
  const urlRaw =
    str(r.url)?.trim() ||
    str(r.file)?.trim() ||
    str(r.link)?.trim() ||
    str(r.document)?.trim() ||
    null;
  const pathRaw = str(r.path)?.trim() || null;
  let url: string | null = null;
  if (urlRaw && /^https?:\/\//i.test(urlRaw)) {
    url = urlRaw;
  } else if (urlRaw) {
    url = resolveProfileImageUrl(urlRaw);
  } else if (pathRaw) {
    url = resolveProfileImageUrl(pathRaw);
  }
  return { label: label.trim() || fallbackLabel, url };
}

function parseConsultationAttachments(info: Record<string, unknown>): ConsultationAttachmentRow[] {
  const raw = info.attachments;
  if (!Array.isArray(raw)) return [];
  const out: ConsultationAttachmentRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = asRecord(raw[i]);
    if (!r) continue;
    out.push(consultationAttachmentRowFromRecord(r, `Attachment ${i + 1}`));
  }
  return out;
}

function parseConsultationReports(info: Record<string, unknown>): ConsultationAttachmentRow[] {
  const raw = info.reports;
  if (!Array.isArray(raw)) return [];
  const out: ConsultationAttachmentRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = asRecord(raw[i]);
    if (!r) continue;
    out.push(consultationAttachmentRowFromRecord(r, `Report ${i + 1}`));
  }
  return out;
}

function mapsUrlFromCoordinates(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(",").map((x) => x.trim());
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a},${b}`)}`;
}

function formatStructuredAddressLine(rec: Record<string, unknown> | null): string | null {
  if (!rec) return null;
  const line1 = str(rec.line_1) ?? str(rec.line1);
  const line2 = str(rec.line_2) ?? str(rec.line2);
  const landmark = str(rec.landmark);
  const area = str(rec.area);
  const city = str(rec.city);
  const state = str(rec.state);
  const pin = str(rec.pincode) ?? str(rec.pin_code) ?? str(rec.pin);
  const cityState = [city, state].filter((x) => (x ?? "").trim().length > 0).join(", ");
  const country = str(rec.country);
  const parts = [line1, line2, landmark, area, cityState, country, pin]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
  const single = parts.join(", ");
  return single.length > 0 ? single : null;
}

/**
 * Pharmacy `info.additional_info.center` often nests lines under `center.address`
 * (with `coordinates` instead of `location` on the parent).
 */
function formatStructuredAddressFromCenter(center: Record<string, unknown> | null): string | null {
  if (!center) return null;
  const nested = asRecord(center.address);
  const fromNested = nested != null ? formatStructuredAddressLine(nested) : null;
  if (fromNested) return fromNested;
  return formatStructuredAddressLine(center);
}

function mapsUrlFromCenterOrNested(center: Record<string, unknown> | null): string | null {
  if (!center) return null;
  const top = mapsUrlFromCoordinates(str(center.location));
  if (top) return top;
  const addr = asRecord(center.address);
  if (addr) {
    return mapsUrlFromCoordinates(str(addr.coordinates) ?? str(addr.location));
  }
  return null;
}

function parsePharmacyOrderLocationCardUi(
  o: Record<string, unknown>,
  info: Record<string, unknown> | null,
  categoryKey: string,
): PharmacyOrderLocationCardUi | null {
  if (categoryKey !== "pharmacy" || info == null) return null;
  const visitRaw = (str(info.visit_type) ?? str(o.visit_type) ?? "").trim().toUpperCase();
  const isHomeDelivery =
    visitRaw === "HOME_DELIVERY" ||
    (visitRaw.includes("HOME") && visitRaw.includes("DELIVER"));

  const vendorRec = asRecord(o.vendor_details);
  const vendorName = str(vendorRec?.name)?.trim() || null;

  const phoneFrom = (addr: Record<string, unknown> | null): string | null => {
    const p = (addr ? str(addr.phone) ?? str(addr.mobile) : null)?.trim() || null;
    return p && p.length > 0 ? p : null;
  };

  if (isHomeDelivery) {
    const addr = asRecord(o.address) ?? asRecord(info.address);
    const addressText = formatStructuredAddressLine(addr);
    const phoneText = phoneFrom(addr);
    const mapsUrl = mapsUrlFromCoordinates(str(addr?.location));
    const headerName = vendorName;
    const cardTitle = "Delivery address";
    const hasAny =
      Boolean(headerName) || Boolean(addressText) || Boolean(phoneText) || Boolean(mapsUrl);
    if (!hasAny) return null;
    return { cardTitle, headerName, addressText, phoneText, mapsUrl };
  }

  return null;
}

function parsePharmacyOrderConfirmCenterUi(info: Record<string, unknown>): PharmacyOrderConfirmCenterUi {
  const infoAdd = asRecord(info.additional_info);
  const center = infoAdd ? asRecord(infoAdd.center) : null;
  if (!center || Object.keys(center).length === 0) {
    return { centerName: null, centerAddress: null, centerPhone: null, mapsUrl: null };
  }
  const centerName =
    str(center.pharmacy_name)?.trim() ||
    str(center.name)?.trim() ||
    str(center.store_name)?.trim() ||
    null;
  const centerAddress = formatStructuredAddressFromCenter(center);
  const centerPhone = str(center.phone)?.trim() || str(center.mobile)?.trim() || null;
  const mapsUrl = mapsUrlFromCenterOrNested(center);
  return { centerName, centerAddress, centerPhone, mapsUrl };
}

/** Vision / dental / vaccine: `data.info.details.center` (service request detail envelope). */
function parseVisionOrderConfirmCenterUi(info: Record<string, unknown>): PharmacyOrderConfirmCenterUi {
  const det = asRecord(info.details);
  const center = det != null ? asRecord(det.center) : null;
  if (!center || Object.keys(center).length === 0) {
    return { centerName: null, centerAddress: null, centerPhone: null, mapsUrl: null };
  }
  const displayAddr = str(center.display_address)?.trim();
  const centerName = str(center.name)?.trim() || null;
  const structured = formatStructuredAddressFromCenter(center);
  const centerAddress =
    displayAddr != null && displayAddr.length > 0 ? displayAddr : structured;
  const centerPhone = str(center.phone) ?? str(center.mobile);
  const mapsUrl = mapsUrlFromCenterOrNested(center);
  return { centerName, centerAddress, centerPhone, mapsUrl };
}

function formatVisionBookingSlotDisplay(info: Record<string, unknown>): string | null {
  const det = asRecord(info.details);
  if (!det) return null;
  const slot = asRecord(det.slot);
  const preferred = str(det.preferred_date_time) ?? str(det.booking_time) ?? null;
  if (slot != null) {
    const sd = str(slot.slot_date);
    const st = str(slot.start_time);
    const et = str(slot.end_time);
    const parts: string[] = [];
    if (sd) parts.push(sd);
    const timePart = [st, et].filter(Boolean).join(" – ");
    if (timePart) parts.push(timePart);
    if (parts.length > 0) return parts.join(", ");
  }
  if (preferred != null) {
    const t = preferred.trim();
    const isoGuess = t.includes("T") ? t : t.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
    const p = Date.parse(isoGuess);
    if (!Number.isNaN(p)) {
      const d = new Date(p);
      const datePart = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${datePart}, ${timePart}`;
    }
    return t;
  }
  return null;
}

/**
 * Vision / dental / vaccine: `SELF_VISIT` → no address card (center is in {@link parseVisionOrderConfirmCenterUi}).
 * `HOME_VISIT` → user address from `info.details.address`.
 */
/** `data.info.details.alternate_phone` (snake or camel) when `info.details` exists. */
function parseInfoDetailsAlternatePhone(info: Record<string, unknown> | null): string | null {
  if (info == null) return null;
  const det = asRecord(info.details);
  if (det == null) return null;
  const raw =
    str(det.alternate_phone)?.trim() ||
    str(det.alternatePhone)?.trim() ||
    null;
  return raw && raw.length > 0 ? raw : null;
}

/** Vaccine: `data.info.details.conditions` / `note` when present. */
function parseInfoDetailsConditionsAndNote(
  info: Record<string, unknown> | null,
  categoryKey: string,
): Readonly<{ conditions: string | null; note: string | null }> {
  if (categoryKey !== "vaccine" || info == null) {
    return { conditions: null, note: null };
  }
  const det = asRecord(info.details);
  if (det == null) return { conditions: null, note: null };
  const conditions = str(det.conditions)?.trim() || null;
  const note = str(det.note)?.trim() || null;
  return {
    conditions: conditions && conditions.length > 0 ? conditions : null,
    note: note && note.length > 0 ? note : null,
  };
}

function parseVisionOrderLocationCardUi(
  o: Record<string, unknown>,
  info: Record<string, unknown> | null,
  categoryKey: string,
): PharmacyOrderLocationCardUi | null {
  if (!SERVICE_REQUEST_PARTNER_DETAIL_CATEGORIES.has(categoryKey) || info == null) return null;
  const visitRaw = (str(info.visit_type) ?? str(o.visit_type) ?? "").trim().toUpperCase();
  if (visitRaw !== "HOME_VISIT") return null;

  const det = asRecord(info.details);
  const addr = det != null ? asRecord(det.address) : null;
  const addressText = formatStructuredAddressLine(addr);
  const phoneText = str(addr?.phone) ?? str(addr?.mobile);
  const mapsUrl = addr != null ? mapsUrlFromCoordinates(str(addr.location)) : null;
  const hasAny =
    Boolean(addressText?.trim()) || Boolean(phoneText?.trim()) || Boolean(mapsUrl?.trim());
  if (!hasAny) return null;
  return {
    cardTitle: "Home visit address",
    headerName: null,
    addressText,
    phoneText,
    mapsUrl,
  };
}

function formatConsultationScheduleDisplay(info: Record<string, unknown>): string | null {
  const add = asRecord(info.additional_info);
  const ts = add ? str(add.time_slot) : null;
  if (ts?.trim()) {
    const t = ts.trim();
    const isoGuess = t.includes("T") ? t : t.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
    const p = Date.parse(isoGuess);
    if (!Number.isNaN(p)) {
      const d = new Date(p);
      const datePart = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${datePart}, ${timePart}`;
    }
    return t;
  }
  const date = str(info.date)?.trim();
  const timePart = str(info.time)?.trim();
  if (!date) return null;
  const iso =
    timePart && timePart.length >= 5
      ? `${date}T${timePart.length === 5 ? `${timePart}:00` : timePart}`
      : `${date}T12:00:00`;
  const p = Date.parse(iso);
  if (!Number.isNaN(p)) {
    const d = new Date(p);
    const dateStr = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  }
  return timePart ? `${date} ${timePart}` : date;
}

/** Lab / LABTEST: `info.additional_info.collection_date` + `collection_slot_time` (and root `info.date`). */
function formatLabOrderSlotDisplay(info: Record<string, unknown>): string | null {
  const add = asRecord(info.additional_info);
  const date = (add ? str(add.collection_date) : null)?.trim() || str(info.date)?.trim() || null;
  const slotTime = (add ? str(add.collection_slot_time) : null)?.trim() || null;
  if (date && slotTime) return `${date}, ${slotTime}`;
  if (slotTime) return slotTime;
  return date;
}

/** Lab: patient’s original ask from `info.additional_info.requested` (before center / slot updates). */
/**
 * Lab invoice `orders[]` (Flutter `subOrders`): non-empty and every row `status === 4` (payment pending).
 */
function labInvoiceSubOrdersAllPaymentPendingStatus(o: Record<string, unknown>): boolean {
  const raw = o.orders;
  if (!Array.isArray(raw) || raw.length === 0) return false;
  for (const item of raw) {
    const rec = asRecord(item);
    if (rec == null) return false;
    const s = rec.status;
    let status: number;
    if (typeof s === "number" && !Number.isNaN(s)) {
      status = Math.trunc(s);
    } else {
      const n = num(s);
      status = n != null && !Number.isNaN(n) ? Math.trunc(n) : -1;
    }
    if (status !== 4) return false;
  }
  return true;
}

function formatLabOrderRequestedSlotDisplay(info: Record<string, unknown>): string | null {
  const add = asRecord(info.additional_info);
  if (!add) return null;
  const req = asRecord(add.requested);
  if (!req) return null;
  const date = str(req.collection_date)?.trim() || null;
  const slotTime = str(req.collection_slot_time)?.trim() || null;
  if (date && slotTime) return `${date}, ${slotTime}`;
  if (slotTime) return slotTime;
  return date;
}

function formatLabInvoiceSubOrderDateHint(raw: string): string {
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const [y, mo, d] = t.split("-").map((x) => Number(x));
  if (!y || !mo || !d) return t;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return t;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Lab `info.status` / sub-order `status` — matches patient_app `lab_order_detail_screen.dart`. */
export function labBookingStatusLabelFromCode(status: number): string {
  const map: Record<number, string> = {
    0: "Waiting for confirmation",
    1: "Completed",
    2: "Cancelled",
    3: "Confirm changes",
    4: "Payment pending",
    5: "Booking confirmed",
    6: "Phlebotomist assigned",
    7: "Sample collected",
    8: "Waiting for report",
    9: "Expired",
  };
  return map[status] ?? "In progress";
}

function labInvoiceInfoStatusTone(status: number): InvoiceOrderRow["statusTone"] {
  switch (status) {
    case 1:
    case 6:
      return "completed";
    case 2:
    case 9:
      return "cancelled";
    case 4:
      return "paymentPending";
    case 5:
      return "upcoming";
    case 3:
      return "confirmPending";
    default:
      return "processing";
  }
}

function labBannerSubtitleForBookingStatus(status: number): string {
  switch (status) {
    case 0:
      return "We're confirming your booking with the lab partner";
    case 1:
      return "Your lab booking is complete";
    case 2:
      return "This booking was cancelled";
    case 3:
      return "Please review and confirm the assigned center or slot";
    case 4:
      return "Complete payment to continue with this booking";
    case 5:
      return "Your collection slot is booked";
    case 6:
      return "A phlebotomist has been assigned";
    case 7:
      return "Sample has been collected";
    case 8:
      return "We're preparing your reports";
    case 9:
      return "This booking is no longer active";
    default:
      return "We're updating this booking";
  }
}

function labInvoiceOrderRowStatus(raw: unknown): number {
  if (typeof raw === "number" && !Number.isNaN(raw)) return Math.trunc(raw);
  const n = num(raw);
  return n != null && !Number.isNaN(n) ? Math.trunc(n) : -1;
}

/** Same window as Flutter `_isLabSubOrderReschedulableNow` (slot start vs now − 1h). */
function isLabSubOrderReschedulableNow(date: string | null, slotTime: string): boolean {
  const d = date?.trim() ?? "";
  const slot = slotTime.trim();
  if (!d || !slot) return false;
  const parts = slot.split("-");
  const start = parts[0]?.trim() ?? "";
  if (!start) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const combined = `${d} ${start}`;
  const dt = new Date(combined);
  const slotMs = dt.getTime();
  if (Number.isNaN(slotMs)) return false;
  const threshold = Date.now() - 60 * 60 * 1000;
  return slotMs >= threshold;
}

function parseLabCollectionAddressId(info: Record<string, unknown> | null): string | null {
  if (info == null) return null;
  const addr = asRecord(info.address);
  if (addr == null) return null;
  const id = str(addr.id)?.trim();
  return id && id.length > 0 ? id : null;
}

function nonEmptyTrimmed(v: unknown): string | null {
  const s = str(v)?.trim();
  return s != null && s.length > 0 ? s : null;
}

/**
 * Reads reschedule-related fields from one lab `orders[]` row (snake/camel and nested `additional_info`).
 */
function parseLabSubOrderRescheduleApiFields(rec: Record<string, unknown>): Readonly<{
  rescheduleReason: string | null;
  rescheduleSlotChangeDisplay: string | null;
  rescheduleAtDisplay: string | null;
  rescheduleCountDisplay: string | null;
}> {
  const add = asRecord(rec.additional_info);

  const fromRescheduleMap = (m: Record<string, unknown> | null): string | null => {
    if (m == null) return null;
    const d =
      nonEmptyTrimmed(m.collection_date) ??
      nonEmptyTrimmed(m.date) ??
      nonEmptyTrimmed(m.slot_date);
    const t =
      nonEmptyTrimmed(m.collection_slot_time) ??
      nonEmptyTrimmed(m.slot_time) ??
      nonEmptyTrimmed(m.start_time);
    if (!d && !t) return null;
    const datePart =
      d != null && /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatLabInvoiceSubOrderDateHint(d) : d;
    if (datePart && t) return `${datePart} · ${t}`;
    return datePart ?? t ?? null;
  };

  const rescheduleMap =
    add != null
      ? asRecord(add.reschedule) ??
        asRecord(add.rescheduled) ??
        asRecord(add.reschedule_request) ??
        asRecord(add.pending_reschedule)
      : null;

  const reason =
    nonEmptyTrimmed(rec.reschedule_reason) ??
    nonEmptyTrimmed(rec.rescheduleReason) ??
    (add != null
      ? nonEmptyTrimmed(add.reschedule_reason) ??
        nonEmptyTrimmed(add.rescheduleReason) ??
        nonEmptyTrimmed(asRecord(add.reschedule)?.reason) ??
        nonEmptyTrimmed(asRecord(add.reschedule_request)?.reason)
      : null);

  const flatSlotLine = ((): string | null => {
    const d =
      nonEmptyTrimmed(rec.reschedule_collection_date) ??
      nonEmptyTrimmed(rec.reschedule_date) ??
      nonEmptyTrimmed(rec.new_collection_date);
    const t =
      nonEmptyTrimmed(rec.reschedule_collection_slot_time) ??
      nonEmptyTrimmed(rec.reschedule_slot_time) ??
      nonEmptyTrimmed(rec.new_slot_time);
    if (!d && !t) return null;
    const datePart =
      d != null && /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatLabInvoiceSubOrderDateHint(d) : d;
    if (datePart && t) return `${datePart} · ${t}`;
    return datePart ?? t ?? null;
  })();

  const nestedSlotLine = fromRescheduleMap(rescheduleMap);
  const rescheduleSlotChangeDisplay =
    flatSlotLine != null ? flatSlotLine : nestedSlotLine != null ? nestedSlotLine : null;

  const atRaw =
    nonEmptyTrimmed(rec.rescheduled_at) ??
    nonEmptyTrimmed(rec.reschedule_at) ??
    nonEmptyTrimmed(rec.reschedule_on) ??
    nonEmptyTrimmed(rec.last_reschedule_at) ??
    (add != null
      ? nonEmptyTrimmed(add.rescheduled_at) ??
        nonEmptyTrimmed(add.reschedule_at) ??
        nonEmptyTrimmed(add.reschedule_on)
      : null);

  const rescheduleAtDisplay = atRaw != null ? formatOrderDateTime(atRaw) : null;

  const countRaw =
    num(rec.reschedule_count) ??
    num(rec.rescheduleCount) ??
    (add != null ? num(add.reschedule_count) ?? num(add.rescheduleCount) : null);
  const rescheduleCountDisplay =
    countRaw != null && !Number.isNaN(countRaw) && countRaw > 0
      ? String(Math.trunc(countRaw))
      : null;

  return {
    rescheduleReason: reason,
    rescheduleSlotChangeDisplay,
    rescheduleAtDisplay,
    rescheduleCountDisplay,
  };
}

function parseLabRescheduleVendorCode(
  o: Record<string, unknown>,
  info: Record<string, unknown> | null,
): string | null {
  if (info != null) {
    const fromInfo =
      str(info.source)?.trim() ??
      str(info.vendor_code)?.trim() ??
      str(info.vendorCode)?.trim();
    if (fromInfo) return fromInfo;
  }
  const vd = asRecord(o.vendor_details);
  if (vd != null) {
    const c =
      str(vd.code)?.trim() ??
      str(vd.vendor_code)?.trim() ??
      str(vd.vendorCode)?.trim();
    if (c) return c;
  }
  return str(o.source)?.trim() ?? null;
}

function parseLabSubOrderCenterFromRow(
  add: Record<string, unknown> | null,
  status: number,
  visitTypeRaw: string,
): PharmacyOrderConfirmCenterUi | null {
  if (status === 0) return null;
  const v = visitTypeRaw.trim().toUpperCase();
  if (v !== "SELF_VISIT") return null;
  const center = add != null ? asRecord(add.center) : null;
  if (!center || Object.keys(center).length === 0) {
    return { centerName: null, centerAddress: null, centerPhone: null, mapsUrl: null };
  }
  const display = str(center.display_address)?.trim();
  const centerName = str(center.name)?.trim() || null;
  const centerAddress =
    display != null && display.length > 0 ? display : formatStructuredAddressFromCenter(center);
  const centerPhone = str(center.phone)?.trim() || str(center.mobile)?.trim() || null;
  const mapsUrl = mapsUrlFromCenterOrNested(center);
  return { centerName, centerAddress, centerPhone, mapsUrl };
}

function subOrderCenterBookingTimeFromAdd(add: Record<string, unknown> | null): string | null {
  if (!add) return null;
  const cd = nonEmptyTrimmed(add.collection_date);
  const ct = nonEmptyTrimmed(add.collection_slot_time);
  if (!cd?.length && !ct?.length) return null;
  const datePart =
    cd != null && cd.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(cd)
      ? formatLabInvoiceSubOrderDateHint(cd)
      : cd ?? "";
  return `Booking time: ${datePart || "—"} ${ct ?? ""}`.trim();
}

function formatLabRequestedUpdateLine(
  requested: Record<string, unknown>,
  add: Record<string, unknown> | null,
): string | null {
  const d =
    nonEmptyTrimmed(requested.collection_date) ??
    (add != null ? nonEmptyTrimmed(add.collection_date) : null) ??
    "";
  const t =
    nonEmptyTrimmed(requested.collection_slot_time) ??
    (add != null ? nonEmptyTrimmed(add.collection_slot_time) : null) ??
    "";
  if (!d.length && !t.length) return null;
  const dp = d.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatLabInvoiceSubOrderDateHint(d) : d;
  return `${dp.length ? dp : "—"}  ·  ${t}`.trim();
}

function parseLabSubOrderRiderFromRow(
  rec: Record<string, unknown>,
  status: number,
  visitTypeRaw: string,
): { name: string; contact: string } | null {
  if ([0, 1, 2, 3, 4].includes(status)) return null;
  if (visitTypeRaw.trim().toUpperCase() !== "HOME_PICKUP") return null;
  const rider = asRecord(rec.rider_info) ?? asRecord(rec.rider);
  if (!rider) return null;
  const name = str(rider.name)?.trim() ?? "";
  if (!name.length) return null;
  const contact =
    str(rider.contact)?.trim() ||
    str(rider.phone)?.trim() ||
    str(rider.mobile)?.trim() ||
    "";
  return { name, contact };
}

function buildLabPatientLineGroups(o: Record<string, unknown>): readonly LabPatientLineGroupUi[] {
  const rawLines = collectLineItemArrays(o);
  type Acc = {
    lines: Array<{ productName: string; priceDisplay: string }>;
    userMap: Record<string, unknown> | null;
  };
  const byUser = new Map<number, Acc>();
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const row = asRecord(raw);
    if (!row) continue;
    const u = asRecord(row.user);
    let uid = 0;
    if (u) {
      const idRaw = u.id;
      uid =
        typeof idRaw === "number" && !Number.isNaN(idRaw)
          ? Math.trunc(idRaw)
          : num(idRaw) != null
            ? Math.trunc(num(idRaw)!)
            : 0;
    }
    const pl = parseDetailLineItem(raw, i);
    if (!pl) continue;
    const priceDisplay =
      pl.lineTotal != null
        ? formatInr(pl.lineTotal)
        : pl.unitPrice != null
          ? formatInr(pl.unitPrice)
          : "—";
    const acc = byUser.get(uid) ?? { lines: [], userMap: u };
    if (!acc.userMap && u) acc.userMap = u;
    acc.lines.push({ productName: pl.productName, priceDisplay });
    byUser.set(uid, acc);
  }
  const keys = [...byUser.keys()].sort((a, b) => a - b);
  return keys.map((k) => {
    const acc = byUser.get(k)!;
    const u = acc.userMap;
    const displayName =
      u != null
        ? str(u.name)?.trim() || str(u.full_name)?.trim() || str(u.fullName)?.trim() || "Patient"
        : "Patient";
    const subtitleParts: string[] = [];
    if (u != null) {
      const age = num(u.age);
      if (age != null && !Number.isNaN(age)) subtitleParts.push(String(Math.floor(age)));
      const g = str(u.gender)?.trim();
      if (g) subtitleParts.push(g);
    }
    return {
      displayName,
      subtitle: subtitleParts.join(" · "),
      lines: acc.lines,
    };
  });
}

function parseLabUploadedPrescriptions(info: Record<string, unknown> | null): ConsultationAttachmentRow[] {
  if (info == null) return [];
  const add = asRecord(info.additional_info);
  const raw = add != null && Array.isArray(add.prescriptions) ? add.prescriptions : null;
  if (raw == null) return [];
  const out: ConsultationAttachmentRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = asRecord(raw[i]);
    if (!r) continue;
    if (r.path == null && r.url == null) continue;
    out.push(consultationAttachmentRowFromRecord(r, `Prescription ${i + 1}`));
  }
  return out;
}

function parseLabSubOrderRows(o: Record<string, unknown>, addressId: string | null): readonly LabSubOrderDetailRow[] {
  const raw = o.orders;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const rows: LabSubOrderDetailRow[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (rec == null) continue;
    const id = str(rec.id)?.trim() ?? "";
    if (!id) continue;
    const status = labInvoiceOrderRowStatus(rec.status);
    const catRaw = str(rec.category)?.trim() ?? "";
    const categoryLower = catRaw.toLowerCase();
    const rescheduleCategory: "pathology" | "radiology" =
      categoryLower === "radiology" ? "radiology" : "pathology";
    const visitTypeRaw = str(rec.visit_type)?.trim() ?? "";
    const visitTypeDisplay =
      visitTypeRaw.length > 0 ? visitTypeRaw.replaceAll("_", " ") : null;
    const date = str(rec.date)?.trim() || null;
    const slotTime = str(rec.slot_time)?.trim() ?? "";
    const dateHint = date != null && date.length > 0 ? formatLabInvoiceSubOrderDateHint(date) : null;
    const dateSlotLine =
      dateHint != null
        ? `Date: ${dateHint}${slotTime.length > 0 ? ` · ${slotTime}` : ""}`
        : slotTime.length > 0
          ? `Date: — · ${slotTime}`
          : null;
    const hasRescheduleKey = Object.prototype.hasOwnProperty.call(rec, "available_reschedule");
    const availableReschedule = hasRescheduleKey ? rec.available_reschedule === true : null;
    const limitRaw = rec.available_reschedule_limit;
    const limitNum =
      limitRaw == null
        ? null
        : typeof limitRaw === "number" && !Number.isNaN(limitRaw)
          ? Math.trunc(limitRaw)
          : (() => {
              const n = num(limitRaw);
              return n != null && !Number.isNaN(n) ? Math.trunc(n) : null;
            })();
    let reschedulePolicyNote: string | null = null;
    if (status === 5 && addressId != null && addressId.length > 0 && hasRescheduleKey) {
      if (availableReschedule === true) {
        reschedulePolicyNote =
          limitNum != null
            ? `Note: You can reschedule only ${limitNum} time(s).`
            : "You can reschedule this booking.";
      } else {
        reschedulePolicyNote =
          "Note: You have reached the maximum number of reschedules. Please contact support for cancellation.";
      }
    }
    const showRescheduleButton =
      status === 5 &&
      (addressId?.length ?? 0) > 0 &&
      availableReschedule === true &&
      isLabSubOrderReschedulableNow(date, slotTime);
    const rs = parseLabSubOrderRescheduleApiFields(rec);
    const addRec = asRecord(rec.additional_info);
    const subOrderCenter = parseLabSubOrderCenterFromRow(addRec, status, visitTypeRaw);
    const subOrderCenterBookingTimeLine = subOrderCenterBookingTimeFromAdd(addRec);
    const requestedMap =
      status === 3 && addRec != null ? asRecord(addRec.requested) : null;
    const requestedUpdateDisplay =
      requestedMap != null ? formatLabRequestedUpdateLine(requestedMap, addRec) : null;
    const riderPair = parseLabSubOrderRiderFromRow(rec, status, visitTypeRaw);
    const showConfirmSubOrderCenterButton =
      status === 3 &&
      subOrderCenter != null &&
      pharmacyOrderConfirmCenterUiHasContent(subOrderCenter);
    rows.push({
      id,
      categoryLabel: catRaw.length > 0 ? catRaw : "—",
      visitTypeDisplay,
      status,
      statusLabel: labBookingStatusLabelFromCode(status),
      dateSlotLine,
      reschedulePolicyNote,
      showRescheduleButton,
      rescheduleCategory,
      rescheduleReason: rs.rescheduleReason,
      rescheduleSlotChangeDisplay: rs.rescheduleSlotChangeDisplay,
      rescheduleAtDisplay: rs.rescheduleAtDisplay,
      rescheduleCountDisplay: rs.rescheduleCountDisplay,
      subOrderCenter,
      subOrderCenterBookingTimeLine,
      showConfirmSubOrderCenterButton,
      requestedUpdateDisplay,
      riderName: riderPair?.name ?? null,
      riderContact: riderPair?.contact ?? null,
    });
  }
  return rows;
}

/** Lab home / registered address from `info.address` when present (sample collection / communication). */
function parseLabOrderLocationCardUi(
  _o: Record<string, unknown>,
  info: Record<string, unknown> | null,
  categoryKey: string,
): PharmacyOrderLocationCardUi | null {
  if (categoryKey !== "lab" || info == null) return null;
  const addr = asRecord(info.address);
  if (!addr) return null;
  const addressText = formatStructuredAddressLine(addr);
  const phoneText = (str(addr.phone) ?? str(addr.mobile))?.trim() || null;
  const mapsUrl = mapsUrlFromCoordinates(str(addr.location));
  const headerName = str(addr.name)?.trim() || str(addr.tag)?.trim() || null;
  const hasAny =
    Boolean(addressText?.trim()) || Boolean(phoneText?.trim()) || Boolean(mapsUrl?.trim());
  if (!hasAny) return null;
  return {
    cardTitle: "Address on file",
    headerName,
    addressText,
    phoneText,
    mapsUrl,
  };
}

function parseConsultationOrderPatientUi(o: Record<string, unknown>): ConsultationOrderPatientUi | null {
  const user = asRecord(o.user);
  if (!user) return null;
  const phone = str(user.phone);
  const email = str(user.email);
  const age = num(user.age);
  const genderRaw = str(user.gender)?.trim().toLowerCase();
  const ageGenderLine =
    age != null && genderRaw
      ? `${Math.floor(age)} · ${genderRaw}`
      : age != null
        ? `${Math.floor(age)}`
        : genderRaw ?? null;
  if (!phone && !email && !ageGenderLine) return null;
  return { phone, email, ageGenderLine };
}

function parseConsultationOrderBookingUi(info: Record<string, unknown>): ConsultationOrderBookingUi {
  const add = asRecord(info.additional_info);
  const booking = add ? asRecord(add.booking_details) : null;
  const clinic = add ? asRecord(add.clinic) : null;
  const specRec = add ? asRecord(add.speciality) ?? asRecord(add.specialty) : null;

  const clinicName =
    (booking ? str(booking.clinic_name) : null) ?? (clinic ? str(clinic.clinic_name) : null) ?? null;
  const doctorName =
    (booking ? str(booking.doctor_name) ?? str(booking.name) : null) ??
    (clinic ? str(clinic.name) : null) ??
    null;

  let specialty: string | null =
    (specRec ? str(specRec.specialty) ?? str(specRec.name) : null) ??
    (clinic ? str(clinic.specialty) : null) ??
    null;
  const specsRaw = booking?.specialties;
  if (
    !specialty &&
    Array.isArray(specsRaw) &&
    specsRaw.length > 0
  ) {
    const first = specsRaw[0];
    if (typeof first === "string") {
      specialty = first.trim() || null;
    } else {
      const fr = asRecord(first);
      specialty = fr ? str(fr.name) ?? str(fr.specialty) : null;
    }
  }

  const qualification = clinic ? str(clinic.qualification) : null;
  const exp = clinic ? num(clinic.experience) : null;
  const experienceLabel =
    exp != null && Number.isFinite(exp)
      ? `${Math.floor(exp)} year${Math.floor(exp) === 1 ? "" : "s"} experience`
      : null;

  const addressLine =
    (booking ? str(booking.clinic_address) ?? str(booking.address) : null) ??
    (clinic ? str(clinic.address) : null) ??
    null;

  const coords = booking ? str(booking.coordinates) : null;
  const mapsUrl = mapsUrlFromCoordinates(coords);

  return {
    scheduleDisplay: formatConsultationScheduleDisplay(info),
    clinicName,
    doctorName,
    specialty,
    qualification,
    experienceLabel,
    addressLine,
    mapsUrl,
  };
}

function formatVisitTypeForDisplay(raw: string | null): string | null {
  const s = str(raw)?.trim();
  if (!s) return null;
  const norm = s.toUpperCase().replace(/\s+/g, "_");
  const table: Record<string, string> = {
    HOME_DELIVERY: "Home delivery",
    STORE_PICKUP: "Store pickup",
    IN_STORE_PICKUP: "In-store pickup",
    PICKUP: "Pickup",
    CURBSIDE_PICKUP: "Curbside pickup",
  };
  if (table[norm]) return table[norm];
  return norm
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function computeWellnessSessionCancelAllowed(
  categoryKey: string,
  serviceInfoStatus: number | null,
  infoForStatus: Record<string, unknown> | null,
): boolean {
  if (categoryKey !== "mental_wellness" && categoryKey !== "nutrition") return false;
  if (serviceInfoStatus !== 5) return false;
  if (!infoForStatus) return false;
  const details = asRecord(infoForStatus.details);
  if (!details) return false;
  const bookingDetails = asRecord(details.booking_details);
  if (!bookingDetails) return false;
  const booking = asRecord(bookingDetails.booking);
  if (!booking) return false;
  const selectedDate = str(booking.selected_date);
  const slotMap = asRecord(booking.slot);
  const startTime = slotMap ? str(slotMap.start_time) : null;
  if (!selectedDate || !startTime) return false;
  let t = Date.parse(`${selectedDate} ${startTime}`);
  if (Number.isNaN(t)) t = Date.parse(`${selectedDate}T${startTime}`);
  if (Number.isNaN(t)) return false;
  return t - Date.now() > 60 * 60 * 1000;
}

function sumRawInvoicePaymentAmounts(o: Record<string, unknown>): number {
  const arr = o.payments;
  if (!Array.isArray(arr)) return 0;
  let s = 0;
  for (const item of arr) {
    const r = asRecord(item);
    if (!r) continue;
    const amt =
      num(r.amount) ??
      num(r.paid_amount) ??
      num(r.paidAmount) ??
      num(r.value) ??
      0;
    if (amt > 0) s += amt;
  }
  return s;
}

/** Hide placeholder enrollee emails (e.g. `N/A`) from gym order detail. */
function invoiceGymDisplayEmail(raw: unknown): string | null {
  const s = nonEmptyTrimmedText(raw);
  if (!s) return null;
  const compact = s.replace(/\s+/g, "");
  if (/^(n\/a|na|null|-)$/i.test(compact)) return null;
  return s;
}

function parseInvoiceGymOrderDetail(
  categoryKey: string,
  info: Record<string, unknown> | null,
): InvoiceGymOrderDetailBlock | null {
  if (categoryKey !== "gym" || info == null) return null;
  const details = asRecord(info.details);
  if (!details) return null;

  const location = nonEmptyTrimmedText(details.location);
  const subscriptionId =
    nonEmptyTrimmedText(details.subscription_id) ?? nonEmptyTrimmedText(info.subscription_id);

  const pkgRaw = asRecord(details.package_details);
  let pkg: InvoiceGymPackageDetails | null = null;
  if (pkgRaw) {
    const mrp = num(pkgRaw.mrp_amount);
    const payAmt = num(pkgRaw.pay_amount);
    const pkgAmt = num(pkgRaw.package_amount);
    pkg = {
      packageName: nonEmptyTrimmedText(pkgRaw.package_name),
      packageCode: nonEmptyTrimmedText(pkgRaw.package_code),
      mrpAmount: mrp,
      payAmount: payAmt,
      packageAmount: pkgAmt,
      mrpFormatted: mrp != null ? formatInr(mrp) : null,
      payAmountFormatted: payAmt != null ? formatInr(payAmt) : null,
      packageAmountFormatted: pkgAmt != null ? formatInr(pkgAmt) : null,
      validityValue: num(pkgRaw.validity_value),
      validityUnits: nonEmptyTrimmedText(pkgRaw.validity_units),
      enableWallet:
        pkgRaw.enable_wallet === true ? true : pkgRaw.enable_wallet === false ? false : null,
      tncHtml: typeof pkgRaw.tnc === "string" && pkgRaw.tnc.trim().length ? pkgRaw.tnc : null,
    };
  }

  const enrollee = asRecord(details.info);
  const enrolleeName = enrollee ? nonEmptyTrimmedText(enrollee.name) : null;
  const enrolleePhone = enrollee ? nonEmptyTrimmedText(enrollee.phone) : null;
  const enrolleeEmail = enrollee ? invoiceGymDisplayEmail(enrollee.email) : null;
  const personalEmail = enrollee ? invoiceGymDisplayEmail(enrollee.personal_email) : null;

  const hasAny =
    Boolean(location) ||
    Boolean(subscriptionId) ||
    pkg != null ||
    Boolean(enrolleeName || enrolleePhone || enrolleeEmail || personalEmail);
  if (!hasAny) return null;

  return {
    location,
    subscriptionId,
    package: pkg,
    enrolleeName,
    enrolleePhone,
    enrolleeEmail,
    personalEmail,
  };
}

function normalizeInvoiceDetail(o: Record<string, unknown>): InvoiceDetailModel {
  const id =
    str(o.id) ??
    str(o.invoice_id) ??
    str(o.invoiceId) ??
    str(o.order_id) ??
    str(o.orderId) ??
    "—";

  const firstLineObj = asRecord(collectLineItemArrays(o)[0]);
  const productTypeFromLine =
    firstLineObj == null
      ? null
      : str(firstLineObj.product_type) ?? str(firstLineObj.productType);

  const typeRaw =
    str(o.transaction_type) ??
    str(o.transactionType) ??
    str(o.type) ??
    str(o.service_type) ??
    str(o.serviceType) ??
    str(o.category) ??
    str(o.order_type) ??
    str(o.orderType) ??
    productTypeFromLine ??
    "";

  const serviceTypeLabel = displayCategoryLabel(typeRaw || null);
  const categoryKey = categoryKeyFromLabel(serviceTypeLabel);

  const orderIdDisplay =
    str(o.order_number) ??
    str(o.orderNumber) ??
    str(o.order_id) ??
    str(o.orderId) ??
    str(o.display_id) ??
    str(o.invoice_number) ??
    str(o.invoice_id) ??
    id;

  const dateRaw =
    str(o.invoice_date) ??
    str(o.invoiceDate) ??
    str(o.created_at) ??
    str(o.createdAt) ??
    str(o.order_date) ??
    str(o.orderDate) ??
    str(o.booked_at) ??
    str(o.date);

  const orderDateTimeDisplay = formatOrderDateTime(dateRaw);

  const typeNorm = normalizedTransactionKind(typeRaw);
  const isConsultationInvoice = typeNorm === "CONSULTATION";
  const infoForStatus = readInvoiceInfoObject(o);
  const infoStatusRaw = infoForStatus != null ? num(infoForStatus.status) : null;
  const infoStatusTrunc =
    infoStatusRaw != null && !Number.isNaN(infoStatusRaw) ? Math.trunc(infoStatusRaw) : null;
  /** Same numeric `info.status` as list rows; null when absent (non-consultation partner orders still set this). */
  const serviceInfoStatus = infoStatusTrunc;
  const consultationInfoStatus =
    isConsultationInvoice && infoStatusTrunc !== null ? infoStatusTrunc : null;

  const infoTypeNormDetail =
    infoForStatus != null
      ? normalizedTransactionKind(str(infoForStatus.type) ?? str(infoForStatus.service_type) ?? "")
      : "";
  const isVisionInvoiceDetail = categoryKey === "vision" || infoTypeNormDetail === "VISION";

  const comm = communicationFromInvoiceRow(o, infoForStatus);
  const commNorm = comm != null ? comm.trim().toUpperCase() : "";
  const isOnline = commNorm === "ONLINE";
  const consultationPlaceTag: InvoiceOrderRow["consultationPlaceTag"] =
    isConsultationInvoice && infoForStatus != null ? (isOnline ? "virtual" : "inPerson") : null;

  const dataPayload = readInvoiceDataObject(o);
  const consultationInfoIdRaw =
    (infoForStatus != null ? str(infoForStatus.id)?.trim() : null) ??
    (isConsultationInvoice && dataPayload ? str(dataPayload.id)?.trim() : null);
  const consultationInfoId =
    consultationInfoIdRaw != null && consultationInfoIdRaw.length > 0
      ? consultationInfoIdRaw
      : null;
  const infoOrderIdFormatted =
    consultationInfoId != null ? `#${consultationInfoId.replace(/^#/, "")}` : null;

  const visitTypeRaw = infoForStatus != null ? str(infoForStatus.visit_type)?.trim() : null;
  const visitTypeFallback = str(o.visit_type)?.trim() ?? null;
  const serviceVisitTypeLabel = formatVisitTypeForDisplay(
    visitTypeRaw ?? visitTypeFallback ?? null,
  );

  const consultationUploadRefIdRaw =
    isConsultationInvoice && infoForStatus != null
      ? appointmentIdFromConsultationPayload(o, infoForStatus)?.trim()
      : null;
  const consultationUploadRefId =
    consultationUploadRefIdRaw && consultationUploadRefIdRaw.length > 0
      ? consultationUploadRefIdRaw
      : consultationInfoId;

  const slotStartMs =
    isConsultationInvoice && infoForStatus != null && !isVisionInvoiceDetail
      ? consultationSlotStartMsFromInfo(infoForStatus)
      : null;
  const isExpiredVirtual =
    isConsultationInvoice &&
    !isVisionInvoiceDetail &&
    isOnline &&
    infoStatusTrunc === 5 &&
    slotStartMs != null &&
    Date.now() > slotStartMs + 10 * 60 * 1000;

  /** Matches {@link normalizeOne} / orders list badge ({@link invoiceListStatusLabelFromInfoStatus}). */
  let statusLabel: string;
  let statusValueTone: InvoiceOrderRow["statusTone"];
  if (isExpiredVirtual) {
    statusLabel = "Expired";
    statusValueTone = "expired";
  } else if (categoryKey === "lab" && infoForStatus != null && infoStatusTrunc !== null) {
    statusLabel = labBookingStatusLabelFromCode(infoStatusTrunc);
    statusValueTone = labInvoiceInfoStatusTone(infoStatusTrunc);
  } else if (infoForStatus != null && infoStatusTrunc !== null) {
    statusLabel = invoiceListStatusLabelFromInfoStatus(
      infoForStatus.status,
      isConsultationInvoice && !isVisionInvoiceDetail,
    );
    statusValueTone = toneFromConsultationInfoStatus(infoForStatus.status);
  } else {
    const d = deriveInvoiceStatus(o);
    statusLabel = d.label;
    statusValueTone = d.tone;
  }

  const bannerTone = mapStatusToneToBanner(statusValueTone);
  const bannerTitle = statusLabel;
  const bannerSubtitle = isExpiredVirtual
    ? "This virtual consultation time slot has ended"
    : categoryKey === "lab" && infoForStatus != null && infoStatusTrunc !== null
      ? labBannerSubtitleForBookingStatus(infoStatusTrunc)
      : infoForStatus != null && infoStatusTrunc !== null
        ? consultationInfoStatusBannerCopy(infoForStatus.status, {
            isVisionOrder: isVisionInvoiceDetail,
          }).subtitle
        : bannerCopy(bannerTone).subtitle;

  const patientName = detailPatientName(o);
  const bookedForName = bookedForNameFromInvoice(o, patientName);
  const vendorName = detailVendorName(o);
  const { lineItems, lineSum } = buildDetailLineItems(o);
  const itemsGrossTotal = resolveDetailSubtotal(o, lineSum);
  const discountNum = invoiceDiscountAmount(o);
  const collectionFeeNum = invoiceCollectionFeeAmount(o);
  const processingFeeNum = invoiceProcessingFeeAmount(o);
  const deliveryChargesNum = invoiceDeliveryChargesAmount(o);
  const walletNum = resolveDetailWallet(o);
  const netPayNum = resolveDetailNetPay(
    o,
    itemsGrossTotal,
    discountNum,
    collectionFeeNum + processingFeeNum,
    deliveryChargesNum,
    walletNum,
  );
  const payments = parseInvoicePayments(o);

  const walletDebitFormatted =
    walletNum != null && walletNum > 0 ? `- ${formatInr(walletNum)}` : null;
  const discountFormatted =
    discountNum > 0 ? `- ${formatInr(discountNum)}` : null;
  const collectionFeeFormatted =
    collectionFeeNum > 0 ? `+ ${formatInr(collectionFeeNum)}` : null;
  const processingFeeFormatted =
    processingFeeNum > 0 ? `+ ${formatInr(processingFeeNum)}` : null;
  const deliveryChargesFormatted =
    deliveryChargesNum > 0 ? `+ ${formatInr(deliveryChargesNum)}` : null;

  const infoAddForPayment =
    infoForStatus != null ? asRecord(infoForStatus.additional_info) : null;
  const dataAdditionalInfoPaymentRequiredKeyPresent =
    infoAddForPayment != null &&
    Object.prototype.hasOwnProperty.call(infoAddForPayment, "payment_required");
  const dataAdditionalInfoPaymentRequired =
    dataAdditionalInfoPaymentRequiredKeyPresent && infoAddForPayment.payment_required === true;
  let dataAdditionalInfoPaymentRequiredKeyPresentResolved =
    dataAdditionalInfoPaymentRequiredKeyPresent;
  let dataAdditionalInfoPaymentRequiredResolved = dataAdditionalInfoPaymentRequired;
  /** Gym invoices may omit `info.additional_info`; infer gateway pay when balance due (no other categories). */
  if (categoryKey === "gym" && !dataAdditionalInfoPaymentRequiredKeyPresent) {
    const paidReported = num(o.paid_amount) ?? 0;
    const paidFromPayments = sumRawInvoicePaymentAmounts(o);
    const paidEffective = Math.max(paidReported, paidFromPayments);
    if (netPayNum > paidEffective && netPayNum > 0) {
      dataAdditionalInfoPaymentRequiredKeyPresentResolved = true;
      dataAdditionalInfoPaymentRequiredResolved = true;
    }
  }
  const consultationPaymentRequired =
    isConsultationInvoice && dataAdditionalInfoPaymentRequiredResolved;
  const infoPaymentRequired = dataAdditionalInfoPaymentRequiredResolved;
  /** Parsed from `o.user` when present — used on consultation and other service order detail UIs. */
  const consultationPatient = parseConsultationOrderPatientUi(o);
  const consultationBooking =
    isConsultationInvoice && infoForStatus != null
      ? parseConsultationOrderBookingUi(infoForStatus)
      : null;
  const consultationOrderDoctor =
    isConsultationInvoice && infoForStatus != null ? parseConsultationDoctor(infoForStatus) : null;
  /** `info.attachments` for any invoice type (e.g. pharmacy prescriptions); reports stay consultation-only. */
  const consultationAttachments =
    infoForStatus != null ? parseConsultationAttachments(infoForStatus) : [];
  const consultationReports =
    isConsultationInvoice && infoForStatus != null ? parseConsultationReports(infoForStatus) : [];
  const labLocParsed =
    categoryKey === "lab" ? parseLabOrderLocationCardUi(o, infoForStatus, categoryKey) : null;
  const labVisitNormForCard = (visitTypeRaw ?? visitTypeFallback ?? "").trim().toUpperCase();
  const labCollectionAddressCard =
    categoryKey === "lab" &&
    labLocParsed != null &&
    labVisitNormForCard !== "SELF_VISIT" &&
    labVisitNormForCard !== "AT_CENTER"
      ? { ...labLocParsed, cardTitle: "Collection address" }
      : null;

  const pharmacyOrderLocation =
    parsePharmacyOrderLocationCardUi(o, infoForStatus, categoryKey) ??
    parseVisionOrderLocationCardUi(o, infoForStatus, categoryKey) ??
    (categoryKey !== "lab" ? labLocParsed : null);

  const pharmacyPreferredSlotDisplay =
    categoryKey === "pharmacy" && infoForStatus != null
      ? formatConsultationScheduleDisplay(infoForStatus)
      : SERVICE_REQUEST_PARTNER_DETAIL_CATEGORIES.has(categoryKey) && infoForStatus != null
        ? formatVisionBookingSlotDisplay(infoForStatus)
        : categoryKey === "lab" && infoForStatus != null
          ? formatLabOrderSlotDisplay(infoForStatus)
          : null;
  const labBookingRequestedRaw =
    categoryKey === "lab" && infoForStatus != null
      ? formatLabOrderRequestedSlotDisplay(infoForStatus)
      : null;
  const labBookingRequestedDisplay =
    labBookingRequestedRaw == null
      ? null
      : pharmacyPreferredSlotDisplay == null ||
          labBookingRequestedRaw.replace(/\s+/g, " ").trim().toLowerCase() !==
            pharmacyPreferredSlotDisplay.replace(/\s+/g, " ").trim().toLowerCase()
        ? labBookingRequestedRaw
        : null;
  const pharmacyConfirmCenterParsed =
    categoryKey === "pharmacy" && infoForStatus != null
      ? parsePharmacyOrderConfirmCenterUi(infoForStatus)
      : SERVICE_REQUEST_PARTNER_DETAIL_CATEGORIES.has(categoryKey) && infoForStatus != null
        ? parseVisionOrderConfirmCenterUi(infoForStatus)
        : categoryKey === "lab" && infoForStatus != null
          ? parsePharmacyOrderConfirmCenterUi(infoForStatus)
          : null;
  const pharmacyConfirmCenter =
    pharmacyConfirmCenterParsed != null &&
    pharmacyOrderConfirmCenterUiHasContent(pharmacyConfirmCenterParsed)
      ? pharmacyConfirmCenterParsed
      : null;
  /** Lab: same `info.status === 3` gate as pharmacy / vision — user confirms center before payment when required. */
  const pharmacyAwaitingDetailConfirmation =
    (isPartnerOrderPayFlowCategory(categoryKey) || categoryKey === "lab") &&
    serviceInfoStatus === 3 &&
    consultationInfoId != null &&
    consultationInfoId.trim().length > 0;

  const infoDetailsAlternatePhone = parseInfoDetailsAlternatePhone(infoForStatus);
  const { conditions: infoDetailsConditions, note: infoDetailsNote } = parseInfoDetailsConditionsAndNote(
    infoForStatus,
    categoryKey,
  );

  const labSubOrdersAllPendingPayment =
    categoryKey === "lab" && labInvoiceSubOrdersAllPaymentPendingStatus(o);

  const labCollectionAddressId =
    categoryKey === "lab" ? parseLabCollectionAddressId(infoForStatus) : null;
  const labRescheduleVendorCode =
    categoryKey === "lab" ? parseLabRescheduleVendorCode(o, infoForStatus) : null;
  const labSubOrders =
    categoryKey === "lab" ? parseLabSubOrderRows(o, labCollectionAddressId) : [];

  const invoiceRootId = str(o.invoice_id) ?? str(o.invoiceId) ?? id;
  const labInvoiceReferenceDisplay =
    categoryKey === "lab" && invoiceRootId !== "—"
      ? `#${invoiceRootId.replace(/^#/, "")}`
      : null;
  const infoAddForLab = infoForStatus != null ? asRecord(infoForStatus.additional_info) : null;
  const labBookingRefRaw =
    categoryKey === "lab" && infoAddForLab != null
      ? str(infoAddForLab.lab_booking_id) ?? str(infoAddForLab.labBookingId)
      : null;
  const labBookingReferenceDisplay =
    labBookingRefRaw != null && labBookingRefRaw.trim().length > 0
      ? `#${labBookingRefRaw.replace(/^#/, "")}`
      : null;
  const labInfoStatusTextLine =
    categoryKey === "lab" && infoForStatus != null
      ? nonEmptyTrimmed(infoForStatus.statusText) ?? nonEmptyTrimmed(infoForStatus.status_text)
      : null;
  const labTrackingUrl =
    categoryKey === "lab" && infoForStatus != null
      ? nonEmptyTrimmed(infoForStatus.tracking_url) ?? nonEmptyTrimmed(infoForStatus.trackingUrl)
      : null;
  const labReportUrl =
    categoryKey === "lab" && infoForStatus != null
      ? nonEmptyTrimmed(infoForStatus.report_url) ?? nonEmptyTrimmed(infoForStatus.reportUrl)
      : null;
  const labCancellationReason =
    categoryKey === "lab" && infoForStatus != null
      ? nonEmptyTrimmed(infoForStatus.cancellation_reason) ??
        nonEmptyTrimmed(infoForStatus.cancellationReason)
      : null;
  const labPatientTestsByMember =
    categoryKey === "lab" ? buildLabPatientLineGroups(o) : [];
  const labUploadedPrescriptions =
    categoryKey === "lab" ? parseLabUploadedPrescriptions(infoForStatus) : [];

  const wellnessSessionCancelAllowed = computeWellnessSessionCancelAllowed(
    categoryKey,
    serviceInfoStatus,
    infoForStatus,
  );

  const gymOrderDetail = parseInvoiceGymOrderDetail(categoryKey, infoForStatus);

  return {
    id,
    bannerTone,
    bannerTitle,
    bannerSubtitle,
    orderIdDisplay,
    consultationPlaceTag,
    consultationInfoStatus,
    consultationInfoId,
    infoOrderIdFormatted,
    serviceVisitTypeLabel,
    consultationUploadRefId,
    consultationPaymentRequired,
    serviceInfoStatus,
    infoPaymentRequired,
    dataAdditionalInfoPaymentRequiredKeyPresent:
      dataAdditionalInfoPaymentRequiredKeyPresentResolved,
    dataAdditionalInfoPaymentRequired: dataAdditionalInfoPaymentRequiredResolved,
    labSubOrdersAllPendingPayment,
    netPayAmount: netPayNum,
    isConsultationOrder: isConsultationInvoice,
    consultationPatient,
    consultationBooking,
    consultationOrderDoctor,
    consultationAttachments,
    consultationReports,
    serviceTypeLabel,
    categoryKey,
    orderDateTimeDisplay,
    statusLabel,
    statusValueTone,
    patientName,
    bookedForName,
    vendorName,
    pharmacyOrderLocation,
    pharmacyAwaitingDetailConfirmation,
    pharmacyPreferredSlotDisplay,
    labBookingRequestedDisplay,
    labSubOrders,
    labCollectionAddressId,
    labRescheduleVendorCode,
    labInvoiceReferenceDisplay,
    labBookingReferenceDisplay,
    labInfoStatusTextLine,
    labTrackingUrl,
    labReportUrl,
    labCancellationReason,
    labCollectionAddressCard,
    labPatientTestsByMember,
    labUploadedPrescriptions,
    pharmacyConfirmCenter,
    infoDetailsAlternatePhone,
    infoDetailsConditions,
    infoDetailsNote,
    lineItems,
    subTotalFormatted: formatInr(itemsGrossTotal),
    discountFormatted,
    collectionFeeFormatted,
    processingFeeFormatted,
    deliveryChargesFormatted,
    walletDebitFormatted,
    walletDebitAmount:
      walletNum != null && walletNum > 0 ? Math.max(0, Math.floor(walletNum)) : 0,
    netPayFormatted: formatInr(netPayNum),
    payments,
    wellnessSessionCancelAllowed,
    gymOrderDetail,
  };
}

// --- Completed online consultation (order detail extras) ---

export type ConsultationPrescriptionRow = Readonly<{
  id: string;
  createdAtLabel: string | null;
  medicineNames: readonly string[];
}>;

export type ConsultationDoctorCard = Readonly<{
  name: string;
  speciality: string;
  imageUrl: string | null;
}>;

/**
 * Parsed from `GET /invoice/:id` when `transaction_type` is consultation, `info.communication` is
 * ONLINE, and a `details[]` line has `status === 1` (completed consultation line).
 */
/** Follow-up virtual consult entry from a completed invoice `info` block. */
export type VirtualFollowUpFromInvoice = Readonly<{
  issueId: number;
  slotsMeta: VirtualSpecialtySlotsState;
  priorAppointmentId: string;
  patientId: number | null;
  language: string | null;
}>;

export type InvoiceConsultationCompletedView = Readonly<{
  symptoms: string | null;
  diagnosis: string | null;
  recommendation: string | null;
  history: string | null;
  appointmentId: string | null;
  prescriptions: readonly ConsultationPrescriptionRow[];
  attachments: readonly ConsultationAttachmentRow[];
  doctor: ConsultationDoctorCard | null;
  /** Follow-up CTA payload; only when `info.status === 1`. */
  followUp: VirtualFollowUpFromInvoice | null;
}>;

function nonEmptyTrimmedText(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const t = s.trim();
  return t.length ? t : null;
}

function hasCompletedConsultationDetailLine(o: Record<string, unknown>): boolean {
  const rootType = normalizedTransactionKind(
    str(o.transaction_type) ?? str(o.transactionType) ?? "",
  );
  if (rootType !== "CONSULTATION") return false;
  const details = o.details;
  if (!Array.isArray(details)) return false;
  for (const item of details) {
    const r = asRecord(item);
    if (!r) continue;
    if (num(r.status) !== 1) continue;
    const pt = normalizedTransactionKind(str(r.product_type) ?? str(r.productType) ?? "");
    if (pt === "CONSULTATION") {
      return true;
    }
  }
  return false;
}

function parseMedicineNamesFromPrescriptionDetails(detailsRaw: unknown): string[] {
  const details = asRecord(detailsRaw);
  if (!details) return [];
  const names: string[] = [];
  for (const key of ["others", "chronic"] as const) {
    const arr = details[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const r = asRecord(item);
      const n = r ? str(r.name) : null;
      if (n != null && n.trim().length > 0) {
        names.push(n.trim());
      }
    }
  }
  return names;
}

function parseConsultationPrescriptions(info: Record<string, unknown>): ConsultationPrescriptionRow[] {
  const raw = info.prescriptions;
  if (!Array.isArray(raw)) return [];
  const out: ConsultationPrescriptionRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = asRecord(raw[i]);
    if (!r) continue;
    const id = str(r.id) ?? `prescription-${i}`;
    const medicineNames = parseMedicineNamesFromPrescriptionDetails(r.details);
    out.push({
      id,
      createdAtLabel: str(r.createdAtDate) ?? str(r.created_at_label) ?? null,
      medicineNames,
    });
  }
  return out;
}

function parseConsultationDoctor(info: Record<string, unknown>): ConsultationDoctorCard | null {
  const doc = asRecord(info.doctor);
  if (!doc) return null;
  const name = str(doc.name);
  if (!name) return null;
  const specRec = asRecord(doc.speciality) ?? asRecord(doc.specialty);
  const speciality =
    str(specRec?.name) ?? str(doc.speciality_name) ?? str(doc.specialityName) ?? str(doc.specialty) ?? "—";
  const imageUrl = resolveProfileImageUrl(str(doc.image));
  return {
    name,
    speciality: speciality.length ? speciality : "—",
    imageUrl,
  };
}

function parseInvoiceFollowUp(
  info: Record<string, unknown>,
  priorAppointmentId: string | null,
): VirtualFollowUpFromInvoice | null {
  const prior = priorAppointmentId?.trim();
  if (!prior) return null;

  const issueFromRoot = num(info.issue_id);
  const issuesRec = asRecord(info.issues);
  const issueFromNested = issuesRec ? num(issuesRec.id) : null;
  const issueId = issueFromRoot ?? issueFromNested;
  if (issueId == null || !Number.isFinite(issueId)) return null;

  const specRoot = num(info.speciality_id);
  const specNestedRec = asRecord(info.speciality);
  const specFromNested = specNestedRec ? num(specNestedRec.id) : null;
  const parent = specRoot ?? specFromNested;
  if (parent == null || !Number.isFinite(parent)) return null;

  const parentInt = Math.floor(parent);
  const issueTitle =
    (issuesRec ? str(issuesRec.title) : null)?.trim() ||
    str(asRecord(info.doctor)?.name)?.trim() ||
    "Consultation";

  const patientId = num(info.patient_id);
  const language = nonEmptyTrimmedText(info.language);

  return {
    issueId: Math.floor(issueId),
    slotsMeta: {
      parent: parentInt,
      issueTitle,
      spid: parentInt,
      language: language ?? "English",
    },
    priorAppointmentId: prior,
    patientId: patientId != null && Number.isFinite(patientId) ? Math.floor(patientId) : null,
    language,
  };
}

function appointmentIdFromConsultationPayload(
  o: Record<string, unknown>,
  info: Record<string, unknown>,
): string | null {
  const addRoot = asRecord(o.additional_info);
  const addInfo = asRecord(info.additional_info);
  return (
    str(addRoot?.appointment_id) ??
    str(addRoot?.appointmentId) ??
    str(addInfo?.appointment_id) ??
    str(addInfo?.appointmentId) ??
    str(info.appointment_id) ??
    str(info.appointmentId) ??
    str(info.id)
  );
}

export function parseInvoiceConsultationCompletedView(
  payload: Record<string, unknown>,
): InvoiceConsultationCompletedView | null {
  if (!hasCompletedConsultationDetailLine(payload)) return null;
  const info = readInvoiceInfoObject(payload);
  if (!info) return null;
  const comm = str(info.communication)?.trim().toUpperCase() ?? "";
  if (comm !== "ONLINE") return null;

  const prescriptions = parseConsultationPrescriptions(info);
  const attachments = parseConsultationAttachments(info);
  const doctor = parseConsultationDoctor(info);
  const appointmentId = appointmentIdFromConsultationPayload(payload, info);
  const infoStatus = num(info.status);
  const followUp =
    infoStatus === 1 ? parseInvoiceFollowUp(info, appointmentId) : null;

  return {
    symptoms: nonEmptyTrimmedText(info.symptoms),
    diagnosis: nonEmptyTrimmedText(info.diagnosis),
    recommendation: nonEmptyTrimmedText(info.recommendation),
    history: nonEmptyTrimmedText(info.history),
    appointmentId,
    prescriptions,
    attachments,
    doctor,
    followUp,
  };
}

async function fetchInvoicePayload(invoiceId: string): Promise<Record<string, unknown>> {
  const id = invoiceId.trim();
  if (!id) {
    throw new Error("Missing invoice id");
  }
  const path = `invoice/${encodeURIComponent(id)}`;
  const body = await patientJson<unknown>(path, { skipGlobalLoading: true });
  const payload = extractInvoicePayload(body);
  if (!payload) {
    throw new Error("Invalid invoice response");
  }
  return payload;
}

/**
 * Single invoice for order details — `GET /invoice/:id`.
 */
export async function fetchInvoiceById(invoiceId: string): Promise<InvoiceDetailModel> {
  const payload = await fetchInvoicePayload(invoiceId);
  return normalizeInvoiceDetail(payload);
}

export type InvoiceOrderPageData = Readonly<{
  detail: InvoiceDetailModel;
  consultationCompleted: InvoiceConsultationCompletedView | null;
}>;

/**
 * Invoice detail plus optional completed-online-consultation blocks for the order screen.
 */
export async function fetchInvoiceOrderPageData(invoiceId: string): Promise<InvoiceOrderPageData> {
  const payload = await fetchInvoicePayload(invoiceId);
  const consultationCompleted = parseInvoiceConsultationCompletedView(payload);
  return {
    detail: normalizeInvoiceDetail(payload),
    consultationCompleted,
  };
}

/**
 * Prescription PDF download for completed consultation orders.
 * Uses `GET /patient/consultation/:appointmentId/report.pdf` (see {@link fetchConsultationReportPdfBlob}).
 */
export async function downloadConsultationPrescriptionPdf(appointmentId: string): Promise<void> {
  const blob = await fetchConsultationReportPdfBlob(appointmentId);
  triggerConsultationReportPdfDownload(appointmentId, blob);
}
