import type { VirtualSpecialtySlotsState } from "@/api/consultationVirtual";
import { patientJson } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

/**
 * Query `type` for `GET /invoice` — align with backend `transaction_type` filters
 * (response uses values like `VACCINE`, `NUTRITION`, `MENTALWELLNESS`).
 */
export const INVOICE_FILTER_TYPES = {
  all: null,
  consultation: "consultation",
  labTest: "labtest",
  pharmacy: "pharmacy",
  dental: "dental",
  vision: "vision",
  vaccine: "vaccine",
  gym: "gym",
  mentalWellness: "mentalwellness",
  nutrition: "nutrition",
} as const;

export type InvoiceFilterId = keyof typeof INVOICE_FILTER_TYPES;

export type InvoiceOrderRow = Readonly<{
  id: string;
  categoryLabel: string;
  categoryKey: string;
  /** `#` + `data.info.id` when present; otherwise empty (no label). */
  orderIdLine: string;
  metaLine: string;
  statusTone: "completed" | "processing" | "cancelled" | "other" | "expired";
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

function statusToneFrom(raw: string | null): InvoiceOrderRow["statusTone"] {
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
  const data = asRecord(o.data);
  if (data) {
    const nested = asRecord(data.info);
    if (nested) return nested;
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

function categoryKeyFromLabel(label: string): string {
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
    mentalwellness: "Mental Wellness",
    nutrition: "Nutrition",
  };
  if (map[k]) return map[k];
  const s = raw.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function deriveInvoiceStatus(o: Record<string, unknown>): {
  label: string;
  tone: InvoiceOrderRow["statusTone"];
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

/** Badge tone for list rows from `data.info.status` (consultation). */
export function consultationInfoStatusOrderRowTone(
  status: unknown,
): InvoiceOrderRow["statusTone"] {
  const raw = num(status);
  const n = raw == null || Number.isNaN(raw) ? null : Math.trunc(raw);
  if (n === 1) return "completed";
  if (n === 2) return "cancelled";
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

  const consultationInfoStatusNum =
    isConsultation && infoObj != null ? num(infoObj.status) : null;
  const slotStartMs =
    isConsultation && infoObj != null ? consultationSlotStartMsFromInfo(infoObj) : null;
  const isExpiredVirtual =
    isConsultation &&
    isOnline &&
    consultationInfoStatusNum === 5 &&
    slotStartMs != null &&
    Date.now() > slotStartMs + 10 * 60 * 1000;

  let statusLabel: string;
  let statusTone: InvoiceOrderRow["statusTone"];
  if (isConsultation && infoObj != null && consultationInfoStatusNum !== null) {
    if (isExpiredVirtual) {
      statusLabel = "Expired";
      statusTone = "expired";
    } else {
      statusLabel = consultationInfoStatusLabelOffline(infoObj.status);
      statusTone = consultationInfoStatusOrderRowTone(infoObj.status);
    }
  } else {
    const d = deriveInvoiceStatus(o);
    statusLabel = d.label;
    statusTone = d.tone;
  }

  const { isFree, amountFormatted } = parseInvoicePricing(o);

  const videoAppointmentId = videoAppointmentIdFromRow(o, infoObj, dataObj);
  const canJoinOnlineConsultation =
    isConsultation &&
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
  if (amountFormatted != null) {
    metaLines.push(amountFormatted);
  }
  const metaLine = metaLines.length > 0 ? metaLines.join("\n") : "—";

  return {
    id,
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
): string {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("page", String(page));
  if (type != null && type.length > 0) {
    q.set("type", type);
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
}): Promise<InvoicesPageResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const path = buildInvoicePath(opts.type ?? null, page, limit);
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
  unitPriceFormatted: string;
  lineTotalFormatted: string;
}>;

/** One label/value row parsed from a payment’s `refunded` object. */
export type InvoiceRefundDetailLine = Readonly<{ label: string; value: string }>;

export type InvoicePaymentRow = Readonly<{
  title: string;
  subtitle: string | null;
  amountFormatted: string;
  statusLabel: string | null;
  paymentSrc: string | null;
  paymentId: string | null;
  paymentType: string | null;
  /** Raw refunded amount from API (for UI checks). */
  amountRefunded: number;
  refundAmountFormatted: string | null;
  refundLines: readonly InvoiceRefundDetailLine[];
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
  /** `info.id` — path param for `PATCH /service/request/cancel/:serviceId` (service cancel). */
  consultationInfoId: string | null;
  serviceTypeLabel: string;
  categoryKey: string;
  orderDateTimeDisplay: string;
  statusLabel: string;
  statusValueTone: InvoiceOrderRow["statusTone"];
  patientName: string;
  vendorName: string;
  lineItems: readonly InvoiceDetailLineItem[];
  /** Sum of line totals (qty × unit) before discount, collection fee (+), and wallet. */
  subTotalFormatted: string;
  discountFormatted: string | null;
  collectionFeeFormatted: string | null;
  walletDebitFormatted: string | null;
  netPayFormatted: string;
  payments: readonly InvoicePaymentRow[];
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

function extractInvoicePayload(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  if (!root) return null;
  const data = root.data;
  if (Array.isArray(data) && data.length > 0) {
    const merged = tryMergeInvoiceFromLineItemsArray(root, data);
    if (merged != null) return merged;
  }
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
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
  unitPrice: number | null;
  lineTotal: number | null;
  dedupeKey: string;
}>;

function parseDetailLineItem(v: unknown, index: number): ParsedLineRow | null {
  const o = asRecord(v);
  if (!o) return null;

  const add = asRecord(o.additional_info);
  const mrpFromAdd = add ? num(add.mrp) : null;

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

  const hasProductFields = str(o.product_name) != null || str(o.productName) != null;
  if (hasProductFields) {
    const lineTotal = unitPrice == null ? null : unitPrice * qty;
    const dedupeKey = str(o.id) ?? `${productName}:${qty}:${unitPrice ?? "x"}`;
    return { productName, qty, unitPrice, lineTotal, dedupeKey };
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
    unitPrice: legacyUnit,
    lineTotal: legacyUnit,
    dedupeKey,
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
 */
export function consultationInfoStatusBannerCopy(status: unknown): { title: string; subtitle: string } {
  const raw = num(status);
  const n = raw == null || Number.isNaN(raw) ? null : Math.trunc(raw);
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

function mapStatusToneToBanner(tone: InvoiceOrderRow["statusTone"]): InvoiceDetailBannerTone {
  if (tone === "completed") return "completed";
  if (tone === "cancelled" || tone === "expired") return "cancelled";
  return "processing";
}

/**
 * Appointment `data.info.status` labels (consultation) — same codes for online/offline; drives order-detail banner when set.
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

function toneFromConsultationInfoStatus(status: unknown): InvoiceOrderRow["statusTone"] {
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
    unitPriceFormatted: pl.unitPrice == null ? "—" : formatInr(pl.unitPrice),
    lineTotalFormatted: pl.lineTotal == null ? "—" : formatInr(pl.lineTotal),
  }));
  const lineSum = parsedLines.reduce((s, pl) => s + (pl.lineTotal ?? 0), 0);
  return { lineItems, lineSum };
}

function invoiceDiscountAmount(o: Record<string, unknown>): number {
  return num(o.discount) ?? num(o.discount_amount) ?? num(o.discountAmount) ?? 0;
}

function invoiceCollectionFeeAmount(o: Record<string, unknown>): number {
  const add = asRecord(o.additional_info);
  const fromAdd = add ? num(add.collection_fee) ?? num(add.collectionFee) : null;
  return fromAdd ?? num(o.collection_fee) ?? num(o.collectionFee) ?? 0;
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
      str(r.method) ??
      str(r.payment_method) ??
      str(r.paymentMethod) ??
      paymentSrc ??
      str(r.mode) ??
      str(r.gateway) ??
      `Payment ${i + 1}`;
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
  return (
    num(o.wallet_amount) ??
    num(o.walletAmount) ??
    num(o.from_wallet) ??
    num(o.fromWallet) ??
    num(o.wallet_debit) ??
    num(o.walletDebit) ??
    num(o.paid_from_wallet) ??
    num(o.paidFromWallet) ??
    num(o.discount_wallet) ??
    null
  );
}

function resolveDetailNetPay(
  o: Record<string, unknown>,
  itemsTotal: number,
  discountNum: number,
  collectionFeeNum: number,
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
  const afterDiscountAndFee = itemsTotal - discountNum + collectionFeeNum;
  return afterDiscountAndFee - (walletNum ?? 0);
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
  const consultationInfoStatusNum =
    isConsultationInvoice && infoForStatus != null ? num(infoForStatus.status) : null;
  const consultationInfoStatus =
    consultationInfoStatusNum != null && !Number.isNaN(consultationInfoStatusNum)
      ? Math.trunc(consultationInfoStatusNum)
      : null;
  const useConsultationInfoStatusForBanner =
    isConsultationInvoice && infoForStatus != null && consultationInfoStatusNum !== null;

  const comm = communicationFromInvoiceRow(o, infoForStatus);
  const commNorm = comm != null ? comm.trim().toUpperCase() : "";
  const isOnline = commNorm === "ONLINE";
  const consultationPlaceTag: InvoiceOrderRow["consultationPlaceTag"] =
    isConsultationInvoice && infoForStatus != null ? (isOnline ? "virtual" : "inPerson") : null;

  const consultationInfoIdRaw =
    isConsultationInvoice && infoForStatus != null ? str(infoForStatus.id)?.trim() : null;
  const consultationInfoId =
    consultationInfoIdRaw != null && consultationInfoIdRaw.length > 0
      ? consultationInfoIdRaw
      : null;

  const slotStartMs =
    isConsultationInvoice && infoForStatus != null
      ? consultationSlotStartMsFromInfo(infoForStatus)
      : null;
  const isExpiredVirtual =
    isConsultationInvoice &&
    isOnline &&
    consultationInfoStatusNum === 5 &&
    slotStartMs != null &&
    Date.now() > slotStartMs + 10 * 60 * 1000;

  let statusLabel: string;
  let statusValueTone: InvoiceOrderRow["statusTone"];
  if (useConsultationInfoStatusForBanner) {
    if (isExpiredVirtual) {
      statusLabel = "Expired";
      statusValueTone = "expired";
    } else {
      statusLabel = consultationInfoStatusLabelOffline(infoForStatus.status);
      statusValueTone = toneFromConsultationInfoStatus(infoForStatus.status);
    }
  } else {
    const d = deriveInvoiceStatus(o);
    statusLabel = d.label;
    statusValueTone = d.tone;
  }

  const bannerTone = mapStatusToneToBanner(statusValueTone);
  const { title: bannerTitle, subtitle: bannerSubtitle } = isExpiredVirtual
    ? {
        title: "Expired",
        subtitle: "This virtual consultation time slot has ended",
      }
    : useConsultationInfoStatusForBanner && infoForStatus != null
      ? consultationInfoStatusBannerCopy(infoForStatus.status)
      : bannerCopy(bannerTone);

  const patientName = detailPatientName(o);
  const vendorName = detailVendorName(o);
  const { lineItems, lineSum } = buildDetailLineItems(o);
  const itemsGrossTotal = resolveDetailSubtotal(o, lineSum);
  const discountNum = invoiceDiscountAmount(o);
  const collectionFeeNum = invoiceCollectionFeeAmount(o);
  const walletNum = resolveDetailWallet(o);
  const netPayNum = resolveDetailNetPay(
    o,
    itemsGrossTotal,
    discountNum,
    collectionFeeNum,
    walletNum,
  );
  const payments = parseInvoicePayments(o);

  const walletDebitFormatted =
    walletNum != null && walletNum > 0 ? `- ${formatInr(walletNum)}` : null;
  const discountFormatted =
    discountNum > 0 ? `- ${formatInr(discountNum)}` : null;
  const collectionFeeFormatted =
    collectionFeeNum > 0 ? `+ ${formatInr(collectionFeeNum)}` : null;

  return {
    id,
    bannerTone,
    bannerTitle,
    bannerSubtitle,
    orderIdDisplay,
    consultationPlaceTag,
    consultationInfoStatus,
    consultationInfoId,
    serviceTypeLabel,
    categoryKey,
    orderDateTimeDisplay,
    statusLabel,
    statusValueTone,
    patientName,
    vendorName,
    lineItems,
    subTotalFormatted: formatInr(itemsGrossTotal),
    discountFormatted,
    collectionFeeFormatted,
    walletDebitFormatted,
    netPayFormatted: formatInr(netPayNum),
    payments,
  };
}

// --- Completed online consultation (order detail extras) ---

export type ConsultationPrescriptionRow = Readonly<{
  id: string;
  createdAtLabel: string | null;
  medicineNames: readonly string[];
}>;

export type ConsultationAttachmentRow = Readonly<{
  label: string;
  url: string | null;
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

function parseConsultationAttachments(info: Record<string, unknown>): ConsultationAttachmentRow[] {
  const raw = info.attachments;
  if (!Array.isArray(raw)) return [];
  const out: ConsultationAttachmentRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = asRecord(raw[i]);
    if (!r) continue;
    const url =
      str(r.url) ??
      str(r.file) ??
      str(r.link) ??
      str(r.path) ??
      str(r.document) ??
      null;
    const label =
      str(r.name) ??
      str(r.file_name) ??
      str(r.fileName) ??
      str(r.title) ??
      str(r.original_name) ??
      `Attachment ${i + 1}`;
    out.push({ label, url });
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
  /**
   * Service reference for the order card (appointment / booking id from payload).
   * When null, the UI falls back to {@link InvoiceDetailModel.orderIdDisplay}.
   */
  appointmentIdForOrderCard: string | null;
}>;

function resolveOrderDetailAppointmentId(
  payload: Record<string, unknown>,
  consultationCompleted: InvoiceConsultationCompletedView | null,
): string | null {
  const fromCc = consultationCompleted?.appointmentId?.trim();
  if (fromCc) return fromCc;
  const info = readInvoiceInfoObject(payload);
  const data = readInvoiceDataObject(payload);
  const fromBooking = videoAppointmentIdFromRow(payload, info, data);
  if (fromBooking?.trim()) return fromBooking.trim();
  return null;
}

/**
 * Invoice detail plus optional completed-online-consultation blocks for the order screen.
 */
export async function fetchInvoiceOrderPageData(invoiceId: string): Promise<InvoiceOrderPageData> {
  const payload = await fetchInvoicePayload(invoiceId);
  const consultationCompleted = parseInvoiceConsultationCompletedView(payload);
  return {
    detail: normalizeInvoiceDetail(payload),
    consultationCompleted,
    appointmentIdForOrderCard: resolveOrderDetailAppointmentId(payload, consultationCompleted),
  };
}

/**
 * Prescription PDF download for the order detail screen.
 * Replace with a real `patientFetch` call when the endpoint is available.
 */
export async function downloadConsultationPrescriptionPdf(prescriptionId: string): Promise<void> {
  const id = prescriptionId.trim();
  if (!id) {
    throw new Error("Missing prescription id");
  }
  void id;
  throw new Error("Prescription download API is not configured yet");
}
