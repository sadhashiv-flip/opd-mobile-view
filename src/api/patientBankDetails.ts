import type { ListPaginationOpts } from "@/api/listPagination";
import { patientFetchChecked, patientJsonList } from "@/api/patientHttp";

/** Row from GET bank_details `data[]`. */
export type PatientBankRecord = Readonly<{
  id: string;
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  accountHolderName: string;
  branch: string;
  cheque: string;
  verifyStatus: number;
  verifyReason: string | null;
  chequeAttachment: Readonly<{
    id: string;
    title: string;
    path: string;
  }> | null;
}>;

export type CreateBankDetailsPayload = Readonly<{
  bank_name: string;
  ifsc_code: string;
  branch: string;
  account_number: string;
  verify_account_number: string;
  account_holder_name: string;
  cheque: string;
}>;

export type BankTypeOption = Readonly<{
  /** From API `key` — sent as `bank_name` and upload form field `bank` */
  key: string;
  /** Display text (prefer API `value`, else title/name) */
  label: string;
}>;

export type BankDetailsPageResult = Readonly<{
  items: PatientBankRecord[];
  page: number;
  hasMore: boolean;
}>;

export type BankTypePageResult = Readonly<{
  items: BankTypeOption[];
  page: number;
  hasMore: boolean;
}>;

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function strNull(v: unknown): string | null {
  const s = str(v);
  return s.length ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function extractBankRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const keys = [
    root.data,
    root.bank_details,
    root.bankDetails,
    root.items,
    root.results,
    root.records,
  ] as const;
  for (const k of keys) {
    if (Array.isArray(k)) return k;
    const inner = asRecord(k);
    if (inner) {
      const a = inner.data ?? inner.items ?? inner.bank_details;
      if (Array.isArray(a)) return a;
    }
  }
  return [];
}

function normalizeChequeAttachment(
  v: unknown,
): PatientBankRecord["chequeAttachment"] {
  const o = asRecord(v);
  if (!o) return null;
  const id = str(o.id);
  if (!id) return null;
  return {
    id,
    title: str(o.title),
    path: str(o.path),
  };
}

function normalizeBankRow(v: unknown): PatientBankRecord | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = str(o.id);
  if (!id) return null;
  const accountHolderName = str(o.account_holder_name);
  const bankName = str(o.bank_name);
  const accountNumber = str(o.account_number);
  const ifscCode = str(o.ifsc_code) || str(o.ifsc);
  const branch = str(o.branch);
  const cheque = str(o.cheque);
  const verifyStatus =
    typeof o.verify_status === "number" ? o.verify_status : Number(o.verify_status) || 0;
  return {
    id,
    bankName,
    ifscCode,
    accountNumber,
    accountHolderName,
    branch,
    cheque,
    verifyStatus,
    verifyReason: strNull(o.verify_reason),
    chequeAttachment: normalizeChequeAttachment(o.cheque_attachment),
  };
}

function hasNextPage(root: Record<string, unknown> | null, itemsLen: number): boolean {
  if (!root) return false;
  const last = root.last_page ?? root.lastPage ?? root.total_pages;
  const current = root.current_page ?? root.page ?? root.currentPage;
  const total = root.total;
  if (typeof last === "number" && typeof current === "number") return current < last;
  if (typeof total === "number" && typeof current === "number" && itemsLen > 0) {
    return total > current * itemsLen;
  }
  const hasMore = root.has_more ?? root.hasMore;
  if (typeof hasMore === "boolean") return hasMore;
  return false;
}

/** GET `/bank_details?page=&limit=` */
export async function fetchBankDetailsPage(
  page = 1,
  pagination?: ListPaginationOpts,
): Promise<BankDetailsPageResult> {
  const raw = await patientJsonList<unknown>(
    "bank_details",
    { method: "GET" },
    { ...pagination, page },
  );
  const root = asRecord(raw);
  const rows = extractBankRows(raw);
  const items = rows
    .map((r) => normalizeBankRow(r))
    .filter((x): x is PatientBankRecord => x != null);
  let pageNum = page;
  if (typeof root?.current_page === "number") pageNum = root.current_page;
  else if (typeof root?.page === "number") pageNum = root.page;
  return {
    items,
    page: pageNum,
    hasMore: hasNextPage(root, items.length),
  };
}

function extractTypeRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const d = root.data;
  if (Array.isArray(d)) return d;
  const inner = asRecord(d);
  if (inner) {
    const a = inner.data ?? inner.items ?? inner.records;
    if (Array.isArray(a)) return a;
  }
  return [];
}

function normalizeBankTypeOption(v: unknown): BankTypeOption | null {
  const o = asRecord(v);
  if (!o) return null;
  const key =
    str(o.key) ||
    str(o.code) ||
    str(o.bank_code) ||
    str(o.short_code) ||
    str(o.id);
  const label =
    str(o.value) ||
    str(o.title) ||
    str(o.name) ||
    str(o.label) ||
    str(o.bank_name) ||
    key;
  if (!key) return null;
  return { key, label };
}

const BANK_TYPE_SEARCH = "type:banks,status=1";

/**
 * GET /patient/type?search=type:banks,status=1&page=…
 * One page; use {@link fetchAllBankTypeOptions} to fill a dropdown with every page.
 */
export async function fetchBankTypePage(
  page = 1,
  pagination?: ListPaginationOpts,
): Promise<BankTypePageResult> {
  const q = new URLSearchParams();
  q.set("search", BANK_TYPE_SEARCH);
  const raw = await patientJsonList<unknown>(
    `type?${q.toString()}`,
    { method: "GET" },
    { ...pagination, page },
  );
  const root = asRecord(raw);
  const rows = extractTypeRows(raw);
  const items = rows
    .map((row) => normalizeBankTypeOption(row))
    .filter((x): x is BankTypeOption => x != null);
  let pageNum = page;
  if (typeof root?.current_page === "number") pageNum = root.current_page;
  else if (typeof root?.page === "number") pageNum = root.page;
  let hasMore = hasNextPage(root, items.length);
  if (items.length === 0) hasMore = false;
  return {
    items,
    page: pageNum,
    hasMore,
  };
}

/**
 * Fetches every page from `type?search=type:banks,status=1` until the API reports no more
 * or returns an empty page (dedupes by `key`, max {@link maxPages}).
 */
export async function fetchAllBankTypeOptions(maxPages = 50): Promise<BankTypeOption[]> {
  const byKey = new Map<string, BankTypeOption>();
  let page = 1;
  while (page <= maxPages) {
    const { items, hasMore } = await fetchBankTypePage(page);
    for (const o of items) {
      byKey.set(o.key, o);
    }
    if (!hasMore || items.length === 0) break;
    page += 1;
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

/** POST /patient/bank_details */
export async function createPatientBankDetails(
  payload: CreateBankDetailsPayload,
): Promise<void> {
  const res = await patientFetchChecked("bank_details", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await res.text();
}

/** PATCH /patient/bank_details/:id */
export async function updatePatientBankDetails(
  id: string,
  payload: CreateBankDetailsPayload,
): Promise<void> {
  const res = await patientFetchChecked(`bank_details/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  await res.text();
}

/** Loads every page of bank_details (dedupes by id). */
export async function fetchAllPatientBankRecords(maxPages = 50): Promise<PatientBankRecord[]> {
  const byId = new Map<string, PatientBankRecord>();
  let page = 1;
  while (page <= maxPages) {
    const r = await fetchBankDetailsPage(page);
    for (const item of r.items) {
      byId.set(item.id, item);
    }
    if (!r.hasMore || r.items.length === 0) break;
    page += 1;
  }
  return Array.from(byId.values());
}

export async function fetchPatientBankById(id: string): Promise<PatientBankRecord | null> {
  const all = await fetchAllPatientBankRecords();
  return all.find((b) => b.id === id) ?? null;
}

/** True if the user has at least one saved bank row. */
export function hasAnyPatientBanks(items: readonly PatientBankRecord[]): boolean {
  return items.length > 0;
}
