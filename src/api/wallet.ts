import { applyListPaginationToPath, type ListPaginationOpts } from "@/api/listPagination";
import { patientJson } from "@/api/patientHttp";
import {
  formatWalletRefTypeTitle,
  WALLET_REF_TYPE_API_VALUES,
  type WalletRefTypeApi,
} from "@/constants/walletRefTypes";
import { walletTransactionOrderDetailPath } from "@/lib/walletTransactionDisplay";

export { WALLET_REF_TYPE_API_VALUES, type WalletRefTypeApi };

export type WalletStatusFilter = "Success" | "Refunded";

export type WalletModuleDisplay = Readonly<{
  refType: string;
  categoryKey: string;
  label: string;
  balance: number | null;
  limit: number | null;
}>;

export type WalletDisplay = Readonly<{
  subscriptionId: string | null;
  availableBalance: number | null;
  totalBalance: number | null;
  validTillLabel: string | null;
  /** Whole days until plan ends; from API `daysLeft` / `days_left`. */
  daysLeft: number | null;
  modules: readonly WalletModuleDisplay[];
}>;

export type WalletTransactionRow = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  amountFormatted: string;
  amountIsCredit: boolean;
  statusLabel: string;
  statusTone: "success" | "refunded";
  iconVariant: "debit" | "refund";
  patientName: string | null;
  invoiceId: string | null;
  refId: string | null;
  note: string | null;
  paymentMode: string | null;
  paymentSource: string | null;
  orderDetailPath: string | null;
}>;

export type WalletTransactionsPageResult = Readonly<{
  items: readonly WalletTransactionRow[];
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
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.trim());
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
  for (const key of ["modules", "breakdown", "wallet_limits", "limits", "data", "items"] as const) {
    const a = rec[key];
    if (Array.isArray(a)) return a;
  }
  return null;
}

/** UI uses `body.wallet` only; falls back if the payload is already the inner wallet object. */
function getWalletPayload(body: unknown): Record<string, unknown> {
  const root = asRecord(body);
  if (!root) return {};
  const nested = asRecord(root.wallet);
  if (nested) return nested;
  if (str(root.subscription_id) != null || num(root.available) != null || asRecord(root.module) != null) {
    return root;
  }
  const data = asRecord(root.data);
  return data ?? root;
}

function extractLegacyModuleArray(body: unknown): unknown[] {
  const root = asRecord(body);
  if (!root) return [];
  const direct = firstArrayInRecord(root);
  if (direct) return direct;
  const wallet = asRecord(root.wallet);
  if (wallet) {
    const nested = firstArrayInRecord(wallet);
    if (nested) return nested;
  }
  const inner = asRecord(root.data);
  if (inner) {
    const nested = firstArrayInRecord(inner);
    if (nested) return nested;
  }
  return [];
}

/** API `wallet.module` map keys → stable grid order. */
const WALLET_MODULE_KEY_ORDER: readonly string[] = [
  "consultation",
  "lab",
  "pharmacy",
  "dental",
  "vision",
  "vaccine",
  "nutrition",
  "fitness",
  "yoga",
  "mental_wellness",
  "mentalwellnesss",
  "chronic_optin",
];

function sortModuleEntries(entries: [string, unknown][]): [string, unknown][] {
  return [...entries].sort(([a], [b]) => {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    let ia = WALLET_MODULE_KEY_ORDER.indexOf(la);
    let ib = WALLET_MODULE_KEY_ORDER.indexOf(lb);
    if (ia < 0) ia = 500;
    if (ib < 0) ib = 500;
    return ia - ib || a.localeCompare(b);
  });
}

/** Label for `wallet.module` object key (UI only). */
function moduleLabelFromApiKey(key: string): string {
  const k = key.toLowerCase();
  const map: Record<string, string> = {
    consultation: "Consultation",
    lab: "Lab",
    pharmacy: "Pharmacy",
    dental: "Dental",
    vision: "Vision",
    vaccine: "Vaccine",
    nutrition: "Nutrition",
    fitness: "Fitness",
    yoga: "Yoga",
    mental_wellness: "Mental Wellness",
    mentalwellnesss: "Mental Wellness",
    chronic_optin: "Chronic Opt-in",
  };
  return map[k] ?? (key.length ? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase() : "Module");
}

/**
 * Parses `wallet.module` record: uses only `available_limit` and `user_limit` / `total_limit` for UI.
 */
function parseWalletModuleRecord(mod: unknown): WalletModuleDisplay[] {
  const rec = asRecord(mod);
  if (!rec) return [];
  const sorted = sortModuleEntries(Object.entries(rec));
  const out: WalletModuleDisplay[] = [];
  for (const [key, val] of sorted) {
    const o = asRecord(val);
    if (!o) continue;
    const availableLimit = num(o.available_limit) ?? num(o.availableLimit);
    const cap = num(o.user_limit) ?? num(o.userLimit) ?? num(o.total_limit) ?? num(o.totalLimit);
    if (availableLimit == null && cap == null) continue;
    out.push({
      refType: key,
      categoryKey: refTypeToCategoryKey(key),
      label: moduleLabelFromApiKey(key),
      balance: availableLimit,
      limit: cap,
    });
  }
  return out;
}

export function refTypeToCategoryKey(refType: string): string {
  const t = refType.trim();
  const lower = t.toLowerCase();
  if (lower === "consultation") return "consultation";
  if (lower === "labtest" || lower === "lab") return "lab";
  if (lower === "pharmacy") return "pharmacy";
  if (lower === "dental") return "dental";
  if (lower === "vision") return "vision";
  if (lower === "vaccine") return "vaccine";
  if (lower === "nutrition") return "nutrition";
  if (lower === "fitness") return "fitness";
  if (lower === "gym") return "gym";
  if (lower === "yoga") return "yoga";
  if (lower.includes("mental") && lower.includes("well")) return "mental_wellness";
  if (lower === "chronic_optin" || lower.includes("chronic")) return "nutrition";
  return "consultation";
}

function moduleLabel(refType: string): string {
  const t = refType.trim();
  if (t.toLowerCase() === "labtest") return "Lab";
  if (t === "MentalWellnesss") return "Mental Wellness";
  if (t === "Chronic_Optin") return "Chronic";
  if (t === "Yoga") return "Yoga";
  return t.length ? t.charAt(0).toUpperCase() + t.slice(1) : "Module";
}

function parseModuleRow(v: unknown, index: number): WalletModuleDisplay | null {
  const o = asRecord(v);
  if (!o) return null;
  const refType =
    str(o.ref_type) ??
    str(o.refType) ??
    str(o.type) ??
    str(o.module) ??
    str(o.category) ??
    `module-${index}`;
  const balance =
    num(o.balance) ??
    num(o.available) ??
    num(o.available_balance) ??
    num(o.availableBalance) ??
    num(o.used) ??
    num(o.remaining);
  const limit =
    num(o.limit) ??
    num(o.total) ??
    num(o.total_limit) ??
    num(o.totalLimit) ??
    num(o.max);
  return {
    refType,
    categoryKey: refTypeToCategoryKey(refType),
    label: str(o.label) ?? str(o.name) ?? moduleLabel(refType),
    balance,
    limit,
  };
}

function formatValidTill(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const mon = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d);
    const day = d.getDate();
    const year = d.getFullYear();
    return `${day} ${mon}, ${year}`;
  }
  return v;
}

/** `expiresAt` often arrives preformatted (e.g. `"30 May, 2026"`). */
function resolveExpiresLabel(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (/[a-zA-Z]{3,}.+\d{4}/.test(t) && (t.includes(",") || /\d{1,2}\s+\w+/.test(t))) {
    return t;
  }
  return formatValidTill(t) ?? t;
}

/** Normalizes GET `opd/wallet` for UI (uses `wallet.subscription_id`, `available`, `total`, `expiresAt`, `wallet.module`). */
export function parseWalletResponse(body: unknown): WalletDisplay {
  const flat = getWalletPayload(body);

  const subscriptionId = str(flat.subscription_id) ?? str(flat.subscriptionId) ?? null;

  const availableBalance = num(flat.available) ?? num(flat.available_balance) ?? num(flat.availableBalance);

  const totalBalance = num(flat.total) ?? num(flat.total_balance) ?? num(flat.totalBalance);

  const validTillLabel = resolveExpiresLabel(
    str(flat.expiresAt) ??
      str(flat.expires_at) ??
      str(flat.valid_till) ??
      str(flat.validTill) ??
      str(flat.valid_until) ??
      str(flat.end_date),
  );

  const daysLeftRaw = num(flat.daysLeft) ?? num(flat.days_left);
  const daysLeft =
    daysLeftRaw != null && Number.isFinite(daysLeftRaw) ? Math.trunc(daysLeftRaw) : null;

  let modules = parseWalletModuleRecord(flat.module ?? flat.modules);
  if (modules.length === 0) {
    modules = extractLegacyModuleArray(body)
      .map((row, i) => parseModuleRow(row, i))
      .filter((x): x is WalletModuleDisplay => x != null);
  }

  return {
    subscriptionId,
    availableBalance,
    totalBalance,
    validTillLabel,
    daysLeft,
    modules,
  };
}

export async function fetchWallet(): Promise<WalletDisplay> {
  const raw = await patientJson<unknown>("opd/wallet", {
    method: "GET",
    skipGlobalLoading: true,
  });
  return parseWalletResponse(raw);
}

function formatInrSigned(amount: number, isCredit: boolean): string {
  const abs = Math.abs(amount);
  const fmt = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(abs);
  return isCredit ? `+ ₹${fmt}` : `- ₹${fmt}`;
}

function formatTxTimestamp(raw: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function normalizeStatus(statusRaw: string | null): { label: string; tone: "success" | "refunded" } {
  const s = (statusRaw ?? "").trim().toLowerCase();
  if (s === "refunded" || s === "refund" || s.includes("refund")) {
    return { label: "Refunded", tone: "refunded" };
  }
  return { label: statusRaw?.trim() || "Success", tone: "success" };
}

/** patient_app `OpdWalletTransaction` — `CREDIT` / `DEBIT` entry type (not `ref_type`). */
function transactionEntryType(raw: Record<string, unknown>): "CREDIT" | "DEBIT" {
  const typeRaw = (str(raw.type) ?? "DEBIT").trim().toUpperCase();
  return typeRaw === "CREDIT" ? "CREDIT" : "DEBIT";
}

function parseTransactionRow(v: unknown, index: number): WalletTransactionRow | null {
  const o = asRecord(v);
  if (!o) return null;
  const id =
    str(o.id) ??
    str(o.transaction_id) ??
    str(o.uuid) ??
    `tx-${index}`;

  const refTypeRaw =
    str(o.ref_type) ??
    str(o.refType) ??
    str(o.module) ??
    str(o.purpose) ??
    str(o.title) ??
    "Transaction";

  const patientRec = asRecord(o.patient);
  const patientName = patientRec ? str(patientRec.name) : null;
  const invoiceId = str(o.invoice_id) ?? str(o.invoiceId);
  const refId = str(o.ref_id) ?? str(o.refId) ?? str(o.reference_id) ?? str(o.referenceId);
  const note = str(o.note);
  const paymentMode = str(o.payment_mode) ?? str(o.paymentMode);
  const paymentSource = str(o.payment_src) ?? str(o.paymentSrc) ?? str(o.payment_source);

  const created =
    str(o.payment_date) ??
    str(o.paymentDate) ??
    str(o.created_at) ??
    str(o.createdAt) ??
    str(o.timestamp) ??
    str(o.date);

  const amountNum =
    num(o.amount) ??
    num(o.value) ??
    num(o.transaction_amount);

  const statusRaw = str(o.status);
  const { label: statusLabel, tone: statusTone } = normalizeStatus(statusRaw);

  const txnTypeRaw = (str(o.transaction_type) ?? "").toLowerCase();
  const isRefund =
    statusTone === "refunded" ||
    o.is_refund === true ||
    o.isRefund === true ||
    txnTypeRaw.includes("refund");

  const entryType = transactionEntryType(o);
  const amountIsCredit = isRefund || entryType === "CREDIT";

  let amountFormatted = "—";
  if (amountNum != null) {
    amountFormatted = formatInrSigned(Math.abs(amountNum), amountIsCredit);
  }

  const iconVariant: "debit" | "refund" = isRefund ? "refund" : "debit";
  const orderDetailPath = walletTransactionOrderDetailPath({
    refType: refTypeRaw,
    invoiceId,
  });

  return {
    id,
    title: formatWalletRefTypeTitle(refTypeRaw),
    dateLabel: formatTxTimestamp(created),
    amountFormatted,
    amountIsCredit,
    statusLabel,
    statusTone,
    iconVariant,
    patientName,
    invoiceId,
    refId,
    note,
    paymentMode,
    paymentSource,
    orderDetailPath,
  };
}

function extractTxArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  for (const key of ["transactions", "data", "items", "results", "list"] as const) {
    const a = root[key];
    if (Array.isArray(a)) return a;
    const inner = asRecord(a);
    if (inner) {
      for (const k2 of ["transactions", "items", "data"] as const) {
        const a2 = inner[k2];
        if (Array.isArray(a2)) return a2;
      }
    }
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

function buildTransactionSearch(
  status: WalletStatusFilter | null,
  refType: WalletRefTypeApi | null,
): string | null {
  const parts: string[] = [];
  if (status) parts.push(`status:${status}`);
  if (refType) parts.push(`ref_type:${refType}`);
  if (parts.length === 0) return null;
  return parts.join(",");
}

export function buildWalletTransactionsPath(
  subscriptionId: string,
  pagination: ListPaginationOpts | undefined,
  filters: Readonly<{ status: WalletStatusFilter | null; refType: WalletRefTypeApi | null }>,
): string {
  const sid = encodeURIComponent(subscriptionId);
  const search = buildTransactionSearch(filters.status, filters.refType);
  const basePath = `opd/wallet/transactions/${sid}`;
  const q = new URLSearchParams();
  if (search) q.set("search", search);
  const pathWithSearch = q.toString() ? `${basePath}?${q.toString()}` : basePath;
  return applyListPaginationToPath(pathWithSearch, pagination);
}

export async function fetchWalletTransactionsPage(
  subscriptionId: string,
  opts: Readonly<{
    page?: number;
    limit?: number;
    status?: WalletStatusFilter | null;
    refType?: WalletRefTypeApi | null;
  }>,
): Promise<WalletTransactionsPageResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const path = buildWalletTransactionsPath(
    subscriptionId,
    { page, limit },
    { status: opts.status ?? null, refType: opts.refType ?? null },
  );
  const body = await patientJson<unknown>(path, {
    method: "GET",
    skipGlobalLoading: true,
  });

  const items = extractTxArray(body)
    .map((v, i) => parseTransactionRow(v, i))
    .filter((x): x is WalletTransactionRow => x != null);

  const meta = extractMeta(body);
  const len = items.length;
  let hasMore = false;
  if (meta.totalPages != null) {
    hasMore = meta.page < meta.totalPages;
  } else if (meta.total != null) {
    hasMore = meta.page * meta.limit < meta.total;
  } else if (len >= limit) {
    hasMore = true;
  }

  return { items, page: meta.page, limit: meta.limit, hasMore };
}
