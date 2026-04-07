import { patientJson } from "@/api/patientHttp";

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
  orderIdLine: string;
  metaLine: string;
  statusTone: "completed" | "processing" | "cancelled" | "other";
  statusLabel: string;
  isFree: boolean;
  amountFormatted: string | null;
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
  const o = asRecord(v);
  if (!o) return null;

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

  const categoryLabel = displayCategoryLabel(typeRaw || null);
  const categoryKey = categoryKeyFromLabel(categoryLabel);

  const orderNum =
    str(o.order_number) ??
    str(o.orderNumber) ??
    str(o.order_id) ??
    str(o.orderId) ??
    str(o.display_id) ??
    str(o.invoice_number) ??
    str(o.invoice_id) ??
    id;
  const orderIdLine = `Order ID: ${orderNum}`;

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
  let metaLine = "—";
  if (memberName != null && memberName.length > 0) {
    metaLine = dateFmt ? `${memberName} • ${dateFmt}` : memberName;
  } else if (dateFmt != null) {
    metaLine = dateFmt;
  }

  const { label: statusLabel, tone: statusTone } = deriveInvoiceStatus(o);
  const { isFree, amountFormatted } = parseInvoicePricing(o);

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

function mapStatusToneToBanner(tone: InvoiceOrderRow["statusTone"]): InvoiceDetailBannerTone {
  if (tone === "completed") return "completed";
  if (tone === "cancelled") return "cancelled";
  return "processing";
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

  const { label: statusLabel, tone: statusValueTone } = deriveInvoiceStatus(o);
  const bannerTone = mapStatusToneToBanner(statusValueTone);
  const { title: bannerTitle, subtitle: bannerSubtitle } = bannerCopy(bannerTone);

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

/**
 * Single invoice for order details — `GET /invoice/:id`.
 */
export async function fetchInvoiceById(invoiceId: string): Promise<InvoiceDetailModel> {
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
  return normalizeInvoiceDetail(payload);
}
