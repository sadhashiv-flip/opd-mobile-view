import { patientFetch, patientFetchChecked, patientJson, patientJsonList } from "@/api/patientHttp";
import type { ListPaginationOpts } from "@/api/listPagination";
import { resolveProfileImageUrl } from "@/api/patientProfile";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function extractRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const d = root.data;
  if (Array.isArray(d)) return d;
  const inner = asRecord(d);
  if (inner) {
    const a = inner.data ?? inner.items ?? inner.records ?? inner.results;
    if (Array.isArray(a)) return a;
  }
  const keys = [root.items, root.results, root.records] as const;
  for (const k of keys) {
    if (Array.isArray(k)) return k;
  }
  return [];
}

export type ReimbursementServiceType = Readonly<{
  key: string;
  value: string;
  id: number;
}>;

export function normalizeReimbursementServiceType(v: unknown): ReimbursementServiceType | null {
  const o = asRecord(v);
  if (!o) return null;
  const key = str(o.key);
  const value = str(o.value);
  const id = typeof o.id === "number" ? o.id : Number(o.id);
  if (!key || !value || !Number.isFinite(id)) return null;
  return { key, value, id };
}

/** GET `/patient/reimbursement/service_types` */
export async function fetchReimbursementServiceTypes(): Promise<ReimbursementServiceType[]> {
  const raw = await patientJson<unknown>("reimbursement/service_types", { method: "GET" });
  return extractRows(raw)
    .map((r) => normalizeReimbursementServiceType(r))
    .filter((x): x is ReimbursementServiceType => x != null);
}

export type ReimbursementClaimSummary = Readonly<{
  id: string;
  claimAmount: number;
  approvedAmount: number | null;
  statusCode: number | null;
  statusLabel: string | null;
  createdAt: string | null;
  userId: string | null;
  /** From nested `user` / `patient` / `member` when list API includes it. */
  patientName: string | null;
}>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
}

function nameFromNestedUser(o: Record<string, unknown>): string | null {
  const keys = ["user", "patient", "member", "profile", "patient_user"] as const;
  for (const k of keys) {
    const n = asRecord(o[k]);
    if (n) {
      const name =
        str(n.name) ||
        str(n.full_name) ||
        str(n.fullName) ||
        str(n.display_name) ||
        str(n.displayName);
      if (name) return name;
    }
  }
  return null;
}

function normalizeClaimSummary(v: unknown): ReimbursementClaimSummary | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = str(o.id);
  if (!id) return null;
  const claimAmount = num(o.claim_amount) ?? num(o.claimAmount) ?? 0;
  const approvedAmount = num(o.approved_amount) ?? num(o.approvedAmount);
  const statusCode =
    typeof o.reimbursement_status === "number"
      ? o.reimbursement_status
      : Number(o.reimbursement_status) || null;
  return {
    id,
    claimAmount,
    approvedAmount: approvedAmount != null && Number.isFinite(approvedAmount) ? approvedAmount : null,
    statusCode: statusCode != null && Number.isFinite(statusCode) ? statusCode : null,
    statusLabel: str(o.reimbursement_status_reason) || str(o.status_label) || null,
    createdAt: str(o.createdAt) || str(o.created_at) || null,
    userId: str(o.user_id) || str(o.userId) || null,
    patientName:
      nameFromNestedUser(o) ||
      (() => {
        const s = str(o.patient_name) || str(o.patientName) || str(o.user_name);
        return s.length ? s : null;
      })(),
  };
}

export type ReimbursementListPageResult = Readonly<{
  items: ReimbursementClaimSummary[];
  page: number;
  hasMore: boolean;
}>;

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

/** GET `/patient/reimbursement` (paginated when server supports `page`). */
export async function fetchReimbursementsPage(
  page = 1,
  pagination?: ListPaginationOpts,
): Promise<ReimbursementListPageResult> {
  const raw = await patientJsonList<unknown>(
    "reimbursement",
    { method: "GET" },
    { ...pagination, page },
  );
  const root = asRecord(raw);
  const rows = extractRows(raw);
  const items = rows
    .map((r) => normalizeClaimSummary(r))
    .filter((x): x is ReimbursementClaimSummary => x != null);
  let pageNum = page;
  if (typeof root?.current_page === "number") pageNum = root.current_page;
  else if (typeof root?.page === "number") pageNum = root.page;
  return {
    items,
    page: pageNum,
    hasMore: hasNextPage(root, items.length),
  };
}

export type ReimbursementBillFileRef = Readonly<{ id: string }>;

/** Row returned from reimbursement `/upload` (normalized for create-claim payload). */
export type ReimbursementUploadFileRecord = Readonly<{
  path: string;
  file_type: string;
  document_type: string;
  ref_type: string;
  id: string;
}>;

/** `service_types` on create claim (per bill and on payment/report/other file rows). */
export type ReimbursementCreateClaimServiceType = Readonly<{
  key: string;
  value: string;
  id: number;
  type: string;
}>;

export function toReimbursementCreateClaimServiceType(st: ReimbursementServiceType): ReimbursementCreateClaimServiceType {
  return { key: st.key, value: st.value, id: st.id, type: st.key };
}

/** Merges unique service types from all bills (order preserved, first occurrence wins). */
export function mergeClaimServiceTypesFromBills(
  bills: readonly { serviceTypes: readonly ReimbursementServiceType[] }[],
): ReimbursementCreateClaimServiceType[] {
  const seen = new Set<number>();
  const out: ReimbursementCreateClaimServiceType[] = [];
  for (const b of bills) {
    for (const st of b.serviceTypes) {
      if (seen.has(st.id)) continue;
      seen.add(st.id);
      out.push(toReimbursementCreateClaimServiceType(st));
    }
  }
  return out;
}

export type ReimbursementCreateBillFileWithServices = ReimbursementUploadFileRecord &
  Readonly<{ service_types: readonly ReimbursementCreateClaimServiceType[] }>;

export type CreateReimbursementBillPayload = Readonly<{
  bill_number: string;
  bill_date: string;
  bill_amount: number;
  clinic_name: string;
  clinic_address: string;
  doctor_name: string;
  doctor_registration_number: string;
  document_name: string;
  reimbursement_bill_files: readonly ReimbursementUploadFileRecord[];
  service_types: readonly ReimbursementCreateClaimServiceType[];
}>;

export type CreateReimbursementPayload = Readonly<{
  user_id: number;
  bank_id: number;
  /** API sample uses string `""` when unset; digits-only string when set. */
  alternative_number: number | string | null;
  reason_for_reimbursement: null;
  claim_amount: number;
  reimbursement_bills: readonly CreateReimbursementBillPayload[];
  reimbursement_bill_payment_files?: readonly ReimbursementCreateBillFileWithServices[];
  reimbursement_report_files?: readonly ReimbursementCreateBillFileWithServices[];
  reimbursement_other_files?: readonly ReimbursementCreateBillFileWithServices[];
}>;

export type CreateReimbursementResult = Readonly<{
  id: string;
  message: string;
  raw: unknown;
}>;

/** Bill scan rows on `reimbursement_bills[]` — no `service_types` on each file (see `api_response.json`). */
export function toReimbursementBillFileApiRow(f: ReimbursementUploadFileRecord): Readonly<{
  path: string;
  file_type: string;
  document_type: string;
  ref_type: string;
  id: string;
}> {
  return {
    path: str(f.path),
    file_type: str(f.file_type) || "IMG",
    document_type: str(f.document_type),
    ref_type: str(f.ref_type) || "BILL",
    id: str(f.id),
  };
}

function toReimbursementCreateClaimServiceTypeApiRow(st: ReimbursementCreateClaimServiceType): Readonly<{
  key: string;
  value: string;
  id: number;
  type: string;
}> {
  const key = str(st.key);
  const value = str(st.value);
  const id = typeof st.id === "number" && Number.isFinite(st.id) ? st.id : Number(st.id);
  const type = str(st.type) || key;
  return { key, value, id: Number.isFinite(id) ? id : 0, type };
}

/**
 * Checklist attachment rows for `reimbursement_bill_payment_files` / `_report_files` / `_other_files`.
 * Matches `api_response.json` (including uppercase `OTHER` for supporting uploads).
 */
export function toReimbursementChecklistFileApiRow(f: ReimbursementCreateBillFileWithServices): Readonly<{
  path: string;
  file_type: string;
  document_type: string;
  ref_type: string;
  id: string;
  service_types: readonly ReturnType<typeof toReimbursementCreateClaimServiceTypeApiRow>[];
}> {
  let document_type = str(f.document_type);
  let ref_type = str(f.ref_type);
  if (ref_type.toUpperCase() === "OTHER" && document_type.toLowerCase() === "other") {
    document_type = "OTHER";
    ref_type = "OTHER";
  }
  return {
    path: str(f.path),
    file_type: str(f.file_type) || "IMG",
    document_type,
    ref_type,
    id: str(f.id),
    service_types: (f.service_types ?? []).map(toReimbursementCreateClaimServiceTypeApiRow),
  };
}

/**
 * JSON body for `POST /patient/reimbursement` aligned with `api_response.json`
 * (field names, nesting, bill files without per-file service_types, always-present file arrays).
 */
export function serializeCreateReimbursementPayload(payload: CreateReimbursementPayload): Record<string, unknown> {
  const alt = payload.alternative_number;
  const alternative_number =
    alt === null || alt === undefined || alt === "" ? "" : typeof alt === "number" ? String(alt) : str(alt);

  const payment = payload.reimbursement_bill_payment_files ?? [];
  const report = payload.reimbursement_report_files ?? [];
  const other = payload.reimbursement_other_files ?? [];

  return {
    user_id: payload.user_id,
    bank_id: payload.bank_id,
    alternative_number,
    reason_for_reimbursement: payload.reason_for_reimbursement,
    claim_amount: payload.claim_amount,
    reimbursement_bills: payload.reimbursement_bills.map((b) => ({
      bill_number: str(b.bill_number),
      bill_date: str(b.bill_date),
      bill_amount: b.bill_amount,
      clinic_name: str(b.clinic_name),
      clinic_address: str(b.clinic_address),
      doctor_name: str(b.doctor_name),
      doctor_registration_number: str(b.doctor_registration_number),
      document_name: str(b.document_name),
      reimbursement_bill_files: b.reimbursement_bill_files.map(toReimbursementBillFileApiRow),
      service_types: b.service_types.map(toReimbursementCreateClaimServiceTypeApiRow),
    })),
    reimbursement_bill_payment_files: payment.map(toReimbursementChecklistFileApiRow),
    reimbursement_report_files: report.map(toReimbursementChecklistFileApiRow),
    reimbursement_other_files: other.map(toReimbursementChecklistFileApiRow),
  };
}

/** POST `/patient/reimbursement/create` */
export async function createReimbursement(
  payload: CreateReimbursementPayload,
): Promise<CreateReimbursementResult> {
  const body = serializeCreateReimbursementPayload(payload);
  const res = await patientFetchChecked("reimbursement/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty reimbursement create response");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid JSON from reimbursement create");
  }
  const root = asRecord(parsed);
  const msg = str(root?.message) || "Reimbursement submitted.";
  const data = asRecord(root?.data);
  const id = str(data?.id) || "";
  return { id, message: msg, raw: parsed };
}

/** GET `/patient/reimbursement/:id` */
export async function fetchReimbursementById(id: string): Promise<unknown> {
  return patientJson<unknown>(`reimbursement/${encodeURIComponent(id)}`, { method: "GET" });
}

/** GET `/patient/reimbursement/document/type?type=` */
export async function fetchReimbursementDocumentTypes(
  serviceKey: string,
): Promise<unknown> {
  const q = new URLSearchParams();
  q.set("type", serviceKey.trim());
  return patientJson<unknown>(`reimbursement/document/type?${q.toString()}`, { method: "GET" });
}

/** GET `/patient/reimbursement/multi_document/type?type=key1,key2,...` — checklist per selected service keys. */
export async function fetchReimbursementMultiDocumentTypes(
  serviceKeys: readonly string[],
): Promise<unknown> {
  const parts = serviceKeys.map((k) => k.trim()).filter(Boolean);
  if (!parts.length) throw new Error("No service types selected");
  const q = new URLSearchParams();
  q.set("type", parts.join(","));
  return patientJson<unknown>(`reimbursement/multi_document/type?${q.toString()}`, { method: "GET" });
}

export type MultiDocumentClaimTypeOption = Readonly<{
  key: string;
  value: string;
}>;

export type MultiDocumentParticularsBlock = Readonly<{
  name: string;
  key: string;
  category: string;
  particulars: readonly string[];
  required: boolean;
}>;

export type MultiDocumentCategoryBlock = Readonly<{
  claimTypes: readonly MultiDocumentClaimTypeOption[];
  categoryLabel: string;
  particulars: MultiDocumentParticularsBlock;
}>;

export type MultiDocumentTypeRow = Readonly<{
  documentType: string;
  required: boolean;
  categories: readonly MultiDocumentCategoryBlock[];
}>;

function parseMultiDocClaimTypes(v: unknown): MultiDocumentClaimTypeOption[] {
  if (!Array.isArray(v)) return [];
  const out: MultiDocumentClaimTypeOption[] = [];
  for (const item of v) {
    const o = asRecord(item);
    if (!o) continue;
    const key = str(o.key);
    const value = str(o.value);
    if (!key && !value) continue;
    out.push({ key, value: value || key });
  }
  return out;
}

function parseMultiDocParticulars(v: unknown): MultiDocumentParticularsBlock | null {
  const o = asRecord(v);
  if (!o) return null;
  const rawList = o.particulars;
  const particulars: string[] = [];
  if (Array.isArray(rawList)) {
    for (const p of rawList) {
      const s = str(p);
      if (s) particulars.push(s);
    }
  }
  return {
    name: str(o.name) || "Document",
    key: str(o.key),
    category: str(o.category),
    particulars,
    required: Boolean(o.required),
  };
}

function parseMultiDocCategoryBlocks(v: unknown): MultiDocumentCategoryBlock[] {
  if (!Array.isArray(v)) return [];
  const out: MultiDocumentCategoryBlock[] = [];
  for (const item of v) {
    const o = asRecord(item);
    if (!o) continue;
    const particulars = parseMultiDocParticulars(o.particulars);
    if (!particulars) continue;
    out.push({
      claimTypes: parseMultiDocClaimTypes(o.claim_type),
      categoryLabel: str(o.category),
      particulars,
    });
  }
  return out;
}

/** Normalizes `GET .../reimbursement/multi_document/type` JSON (see `api_response.json`). */
export function parseReimbursementMultiDocumentTypes(body: unknown): MultiDocumentTypeRow[] {
  const root = asRecord(body);
  const arr = Array.isArray(root?.data) ? root.data : [];
  const out: MultiDocumentTypeRow[] = [];
  for (const row of arr) {
    const o = asRecord(row);
    if (!o) continue;
    out.push({
      documentType: str(o.document_type) || "Document",
      required: Boolean(o.required),
      categories: parseMultiDocCategoryBlocks(o.category),
    });
  }
  return out;
}

export function formatReimbursementDocTypeLabel(slug: string): string {
  const s = slug.trim() || "document";
  return s
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Drives `/upload` FormData for reimbursement checklist files (see Postman / product spec). */
export type ChecklistUploadKind = "payment" | "prescription" | "report" | "support" | "legacy";

/** One upload target on the bill document checklist page. */
export type BillChecklistSlot = Readonly<{
  slotId: string;
  required: boolean;
  sectionTitle: string;
  particularsName: string;
  /** Legacy BILL uploads: checklist key; ignored for fixed-profile kinds. */
  particularsKey: string;
  categoryLabel: string;
  /** Human-readable labels from multi-doc `claim_type` (for display). */
  claimLabels: readonly string[];
  /** Keys from multi-doc `claim_type`; used to filter which catalog types apply to this slot. */
  claimTypeKeys: readonly string[];
  bullets: readonly string[];
  /** API row `document_type` slug (e.g. `reports`, `payments`). */
  rowDocumentType: string;
  uploadKind: ChecklistUploadKind;
}>;

function checklistUploadKindForEmptyRow(documentType: string): ChecklistUploadKind {
  const n = documentType.trim().toLowerCase();
  if (n === "payments" || n === "payment") return "payment";
  if (n === "support" || n === "other") return "support";
  return "legacy";
}

function checklistUploadKindForCategory(categoryLabel: string): ChecklistUploadKind {
  const n = categoryLabel.trim().toLowerCase();
  if (n === "prescription") return "prescription";
  if (n === "report" || n === "reports") return "report";
  if (n === "support" || n === "other") return "support";
  return "legacy";
}

export function buildBillChecklistSlots(rows: readonly MultiDocumentTypeRow[]): BillChecklistSlot[] {
  const out: BillChecklistSlot[] = [];
  for (const row of rows) {
    const rowDt = row.documentType.trim() || "document";
    const sectionTitle = formatReimbursementDocTypeLabel(row.documentType);
    if (row.categories.length === 0) {
      const kind = checklistUploadKindForEmptyRow(rowDt);
      out.push({
        slotId: `slot:${row.documentType}::__empty__`,
        required: row.required,
        sectionTitle,
        particularsName: sectionTitle,
        particularsKey: rowDt || "document",
        categoryLabel: "",
        claimLabels: [],
        claimTypeKeys: [],
        bullets: [],
        rowDocumentType: rowDt,
        uploadKind: kind,
      });
      continue;
    }
    row.categories.forEach((cat, idx) => {
      const pKey = cat.particulars.key.trim() || `${row.documentType}_${idx}`;
      const kind = checklistUploadKindForCategory(cat.categoryLabel);
      out.push({
        slotId: `slot:${row.documentType}::${pKey}::${idx}`,
        required: row.required && cat.particulars.required,
        sectionTitle,
        particularsName: cat.particulars.name,
        particularsKey: pKey,
        categoryLabel: cat.categoryLabel,
        claimLabels: cat.claimTypes.map((c) => c.value),
        claimTypeKeys: cat.claimTypes.map((c) => c.key.trim()).filter(Boolean),
        bullets: cat.particulars.particulars,
        rowDocumentType: rowDt,
        uploadKind: kind,
      });
    });
  }
  return out;
}

export function areBillChecklistRequirementsMet(
  slots: readonly BillChecklistSlot[],
  filesBySlot: Readonly<Record<string, readonly ReimbursementCreateBillFileWithServices[]>>,
): boolean {
  for (const s of slots) {
    const files = filesBySlot[s.slotId] ?? [];
    if (s.required && files.length < 1) return false;
    for (const f of files) {
      if (!f.service_types.length) return false;
    }
  }
  return true;
}

export type ChecklistFilesPartitionInput = Readonly<{
  multiDocRows: readonly MultiDocumentTypeRow[];
  checklistFilesBySlot: Readonly<Record<string, readonly ReimbursementCreateBillFileWithServices[]>>;
}>;

/** Splits checklist uploads into create-claim file arrays (each file keeps its own `service_types`). */
export function partitionChecklistFilesForCreate(bill: ChecklistFilesPartitionInput): Readonly<{
  payment: readonly ReimbursementCreateBillFileWithServices[];
  report: readonly ReimbursementCreateBillFileWithServices[];
  other: readonly ReimbursementCreateBillFileWithServices[];
}> {
  const payment: ReimbursementCreateBillFileWithServices[] = [];
  const report: ReimbursementCreateBillFileWithServices[] = [];
  const other: ReimbursementCreateBillFileWithServices[] = [];
  const slots = buildBillChecklistSlots(bill.multiDocRows);
  for (const slot of slots) {
    const files = bill.checklistFilesBySlot[slot.slotId] ?? [];
    for (const f of files) {
      const row: ReimbursementCreateBillFileWithServices = {
        id: f.id,
        path: f.path,
        file_type: f.file_type,
        document_type: f.document_type,
        ref_type: f.ref_type,
        service_types: [...f.service_types],
      };
      if (slot.uploadKind === "payment") payment.push(row);
      else if (slot.uploadKind === "prescription" || slot.uploadKind === "report") report.push(row);
      else other.push(row);
    }
  }
  return { payment, report, other };
}

/**
 * Service-type chips for a checklist slot should not list the entire catalog — only types
 * allowed for that document (`claim_type` keys), or (when the API omits them) types chosen for the bill.
 */
export function filterServiceTypesCatalogForChecklistSlot(
  catalog: readonly ReimbursementServiceType[],
  slot: Pick<BillChecklistSlot, "claimTypeKeys"> | null,
  billSelectedKeys: ReadonlySet<string>,
): ReimbursementServiceType[] {
  const slotKeys = new Set((slot?.claimTypeKeys ?? []).map((k) => k.trim()).filter(Boolean));
  if (slotKeys.size > 0) {
    return catalog.filter((t) => slotKeys.has(t.key.trim()));
  }
  if (billSelectedKeys.size > 0) {
    return catalog.filter((t) => billSelectedKeys.has(t.key.trim()));
  }
  return [...catalog];
}

/** Unique display labels from `service_types` on all checklist files for one bill. */
export function uniqueChecklistServiceTypeLabelsForBill(
  bill: Readonly<{
    multiDocChecklist?: Readonly<{ rows: readonly MultiDocumentTypeRow[] }>;
    checklistFilesBySlot: Readonly<Record<string, readonly { service_types: readonly ReimbursementCreateClaimServiceType[] }[]>>;
  }>,
): string[] {
  const slots = buildBillChecklistSlots(bill.multiDocChecklist?.rows ?? []);
  const seen = new Set<number>();
  const labels: string[] = [];
  for (const s of slots) {
    for (const f of bill.checklistFilesBySlot[s.slotId] ?? []) {
      for (const st of f.service_types) {
        if (seen.has(st.id)) continue;
        seen.add(st.id);
        const label = (st.value || st.key).trim();
        if (label) labels.push(label);
      }
    }
  }
  return labels;
}

/** Counts uploaded checklist files on a bill whose slots match any of `kinds`. */
export function countChecklistFilesForKinds(
  bill: Readonly<{
    multiDocChecklist?: Readonly<{ rows: readonly MultiDocumentTypeRow[] }>;
    checklistFilesBySlot: Readonly<Record<string, readonly ReimbursementCreateBillFileWithServices[]>>;
  }>,
  kinds: readonly ChecklistUploadKind[],
): number {
  const want = new Set(kinds);
  const slots = buildBillChecklistSlots(bill.multiDocChecklist?.rows ?? []);
  let n = 0;
  for (const s of slots) {
    if (!want.has(s.uploadKind)) continue;
    n += bill.checklistFilesBySlot[s.slotId]?.length ?? 0;
  }
  return n;
}

/** GET `/patient/reimbursement/steps/:id` */
export async function fetchReimbursementSteps(claimId: string): Promise<unknown> {
  return patientJson<unknown>(
    `reimbursement/steps/${encodeURIComponent(claimId)}`,
    { method: "GET" },
  );
}

export type ReimbursementAttachmentRow = Readonly<{
  id: string;
  label: string;
  openUrl: string | null;
}>;

export type ReimbursementBillDetail = Readonly<{
  billId: string;
  billNumber: string;
  billDate: string | null;
  clinicName: string | null;
  /** Bill-level service labels (often comma-joined human-readable types). */
  documentName: string | null;
  /** Service keys on this bill (mapped to labels in the claim UI via service types catalog). */
  serviceKeys: readonly string[];
  files: readonly ReimbursementAttachmentRow[];
}>;

export type ReimbursementBankDetail = Readonly<{
  accountHolderName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  branch: string | null;
  ifscCode: string | null;
}>;

export type ReimbursementHistoryStep = Readonly<{
  title: string;
  at: string | null;
}>;

export type ReimbursementDetail = Readonly<{
  id: string;
  claimAmount: number;
  approvedAmount: number | null;
  statusCode: number | null;
  statusLabel: string | null;
  createdAt: string | null;
  patientName: string | null;
  phone: string | null;
  serviceTypeLine: string | null;
  /** Claim / bill service keys when API does not send a human-readable line yet. */
  serviceTypeKeys: readonly string[];
  bank: ReimbursementBankDetail | null;
  bills: readonly ReimbursementBillDetail[];
  paymentReceiptFiles: readonly ReimbursementAttachmentRow[];
  reportFiles: readonly ReimbursementAttachmentRow[];
  otherFiles: readonly ReimbursementAttachmentRow[];
}>;

function unwrapDataObject(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  if (!root) return null;
  const d = asRecord(root.data);
  return d ?? root;
}

function attachmentRowFromRecord(r: Record<string, unknown>, fallbackLabel: string): ReimbursementAttachmentRow | null {
  const id = str(r.id) || str(r.file_id) || str(r.attachment_id);
  if (!id) return null;
  const nested = asRecord(r.file) ?? asRecord(r.attachment) ?? asRecord(r.document);
  const label =
    str(r.file_name) ||
    str(r.fileName) ||
    str(r.name) ||
    str(r.title) ||
    str(r.document_name) ||
    str(r.original_name) ||
    (nested && (str(nested.title) || str(nested.file_name) || str(nested.name))) ||
    fallbackLabel;
  const urlRaw =
    str(r.url)?.trim() ||
    str(r.file)?.trim() ||
    str(r.link)?.trim() ||
    str(r.document)?.trim() ||
    (nested && (str(nested.url) || str(nested.link))) ||
    null;
  const pathRaw =
    str(r.path)?.trim() ||
    str(r.logo)?.trim() ||
    (nested && (str(nested.path) || str(nested.logo))) ||
    null;
  let openUrl: string | null = null;
  if (urlRaw && /^https?:\/\//i.test(urlRaw)) openUrl = urlRaw;
  else if (urlRaw) openUrl = resolveProfileImageUrl(urlRaw);
  else if (pathRaw) openUrl = resolveProfileImageUrl(pathRaw);
  return { id, label: label.trim() || fallbackLabel, openUrl };
}

function pushServiceKey(out: string[], raw: unknown): void {
  if (typeof raw === "string" || typeof raw === "number") {
    const s = str(raw);
    if (s) out.push(s);
    return;
  }
  const o = asRecord(raw);
  if (!o) return;
  const k =
    str(o.key) ||
    str(o.service_key) ||
    str(o.serviceKey) ||
    str(o.type) ||
    str(o.code) ||
    str(o.slug);
  if (k) out.push(k);
}

function extractServiceKeysFromBill(b: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const arrays = [
    b.service_types,
    b.serviceTypes,
    b.reimbursement_service_types,
    b.reimbursement_service_keys,
    b.reimbursement_services,
    b.reimbursementServices,
    b.services,
    b.claim_types,
    b.claimTypes,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) pushServiceKey(keys, item);
  }
  return [...new Set(keys.map((x) => x.trim()).filter(Boolean))];
}

function extractServiceKeysFromClaimRoot(d: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const arrays = [
    d.reimbursement_services,
    d.reimbursementServices,
    d.service_types,
    d.serviceTypes,
    d.services,
    d.claim_service_types,
    d.claim_services,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) pushServiceKey(keys, item);
  }
  const addInfo = asRecord(d.additional_info) ?? asRecord(d.additionalInfo);
  if (addInfo) {
    for (const arr of [addInfo.service_types, addInfo.serviceTypes, addInfo.services]) {
      if (!Array.isArray(arr)) continue;
      for (const x of arr) pushServiceKey(keys, x);
    }
  }
  return [...new Set(keys.map((x) => x.trim()).filter(Boolean))];
}

const GENERIC_SERVICE_TYPE = /^reimbursement_service$/i;

/**
 * Tries authenticated binary routes for reimbursement uploads referenced only by `id`.
 * Returns a `blob:` URL the caller should {@link URL.revokeObjectURL} when done.
 */
export async function fetchReimbursementAttachmentBlobUrl(attachmentId: string): Promise<string> {
  const id = attachmentId.trim();
  if (!id) throw new Error("Missing attachment id");
  const paths = [
    `reimbursement/attachment/${encodeURIComponent(id)}`,
    `reimbursement/attachments/${encodeURIComponent(id)}`,
    `reimbursement/file/${encodeURIComponent(id)}`,
  ];
  for (const p of paths) {
    const res = await patientFetch(p, {
      method: "GET",
      skipGlobalLoading: true,
      headers: { Accept: "*/*" },
    });
    if (!res.ok) continue;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("application/json")) continue;
    const blob = await res.blob();
    if (!blob.size) continue;
    return URL.createObjectURL(blob);
  }
  throw new Error("Could not load attachment");
}

function mapFileArray(raw: unknown, fallbackPrefix: string): readonly ReimbursementAttachmentRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ReimbursementAttachmentRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const o = asRecord(raw[i]);
    if (!o) continue;
    const row = attachmentRowFromRecord(o, `${fallbackPrefix} ${i + 1}`);
    if (row) out.push(row);
  }
  return out;
}

function normalizeBankDetail(v: unknown): ReimbursementBankDetail | null {
  const o = asRecord(v);
  if (!o) return null;
  return {
    accountHolderName: str(o.account_holder_name) || str(o.accountHolderName) || null,
    bankName: str(o.bank_name) || str(o.bankName) || null,
    accountNumber: str(o.account_number) || str(o.accountNumber) || null,
    branch: str(o.branch) || null,
    ifscCode: str(o.ifsc_code) || str(o.ifscCode) || null,
  };
}

function serviceValuesFromServiceArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const item of arr) {
    const o = asRecord(item);
    if (o) {
      const v = str(o.value) || str(o.name) || str(o.label) || str(o.title);
      if (v) out.push(v);
    } else if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
    }
  }
  return out;
}

function serviceTypeLineFromData(d: Record<string, unknown>, bills: readonly ReimbursementBillDetail[]): string | null {
  const direct =
    str(d.service_type_display) ||
    str(d.serviceTypeDisplay) ||
    str(d.service_types_label) ||
    str(d.service_types_names) ||
    str(d.serviceTypesNames) ||
    "";
  if (direct) return direct;

  const fromArrays = [
    ...serviceValuesFromServiceArray(d.reimbursement_services),
    ...serviceValuesFromServiceArray(d.reimbursementServices),
    ...serviceValuesFromServiceArray(d.services),
  ].filter(Boolean);
  if (fromArrays.length) return [...new Set(fromArrays)].join(", ");

  const stLabel = str(d.service_types) || str(d.serviceTypes);
  if (stLabel && !GENERIC_SERVICE_TYPE.test(stLabel)) return stLabel;

  const fromBills = bills.map((b) => (b.documentName ?? "").trim()).filter(Boolean);
  const parts = [...new Set(fromBills)];
  if (parts.length) return parts.join(", ");

  const st = str(d.service_type) || str(d.serviceType);
  if (st.length && !GENERIC_SERVICE_TYPE.test(st)) return st;
  return null;
}

/** Parses `GET /patient/reimbursement/:id` JSON into a stable detail model. */
export function parseReimbursementDetailResponse(body: unknown): ReimbursementDetail | null {
  const d = unwrapDataObject(body);
  if (!d) return null;
  const idRaw = d.id;
  const id =
    (typeof idRaw === "number" && Number.isFinite(idRaw) ? String(idRaw) : str(idRaw)) || "";
  if (!id) return null;

  const billsRaw = d.reimbursement_bills;
  const bills: ReimbursementBillDetail[] = [];
  if (Array.isArray(billsRaw)) {
    for (let i = 0; i < billsRaw.length; i++) {
      const b = asRecord(billsRaw[i]);
      if (!b) continue;
      const billIdRaw = b.id;
      const billId =
        (typeof billIdRaw === "number" && Number.isFinite(billIdRaw) ? String(billIdRaw) : str(billIdRaw)) ||
        `bill_${i}`;
      const files = mapFileArray(b.reimbursement_bill_files, "File");
      bills.push({
        billId,
        billNumber: str(b.bill_number) || str(b.billNumber) || "—",
        billDate: str(b.bill_date) || str(b.billDate) || null,
        clinicName: str(b.clinic_name) || str(b.clinicName) || null,
        documentName: str(b.document_name) || str(b.documentName) || null,
        serviceKeys: extractServiceKeysFromBill(b),
        files,
      });
    }
  }

  const paymentReceiptFiles = mapFileArray(d.reimbursement_bill_payment_files, "Receipt");
  const reportFiles = mapFileArray(d.reimbursement_report_files, "Report");
  const otherFiles = mapFileArray(d.reimbursement_other_files, "Document");

  const user = asRecord(d.user);
  const patientName =
    (user && (str(user.name) || str(user.full_name) || str(user.fullName))) ||
    nameFromNestedUser(d) ||
    str(d.patient_name) ||
    str(d.patientName) ||
    null;
  const phone =
    (user && (str(user.phone) || str(user.mobile))) ||
    str(d.phone) ||
    (user && str(user.alternative_number)) ||
    str(d.alternative_number) ||
    null;

  const claimAmount = num(d.claim_amount) ?? num(d.claimAmount) ?? 0;
  const approvedAmount = num(d.approved_amount) ?? num(d.approvedAmount);
  const statusCode =
    typeof d.reimbursement_status === "number"
      ? d.reimbursement_status
      : Number(d.reimbursement_status) || null;

  const rootKeys = extractServiceKeysFromClaimRoot(d);
  const billKeys = bills.flatMap((b) => [...b.serviceKeys]);
  const serviceTypeKeys = [...new Set([...rootKeys, ...billKeys].map((x) => x.trim()).filter(Boolean))];

  return {
    id,
    claimAmount,
    approvedAmount: approvedAmount != null && Number.isFinite(approvedAmount) ? approvedAmount : null,
    statusCode: statusCode != null && Number.isFinite(statusCode) ? statusCode : null,
    statusLabel: str(d.reimbursement_status_reason) || str(d.status_label) || null,
    createdAt: str(d.createdAt) || str(d.created_at) || null,
    patientName,
    phone,
    serviceTypeLine: serviceTypeLineFromData(d, bills),
    serviceTypeKeys,
    bank: normalizeBankDetail(d.bank_details ?? d.bankDetails),
    bills,
    paymentReceiptFiles,
    reportFiles,
    otherFiles,
  };
}

/** Parses `GET /patient/reimbursement/steps/:id` into timeline rows (best-effort). */
export function parseReimbursementStepsResponse(body: unknown): readonly ReimbursementHistoryStep[] {
  const extractArray = (): unknown[] => {
    if (Array.isArray(body)) return body;
    const root = asRecord(body);
    if (!root) return [];
    const d = root.data;
    if (Array.isArray(d)) return d;
    const inner = asRecord(d);
    if (inner) {
      const a = inner.steps ?? inner.history ?? inner.timeline ?? inner.items ?? inner.records;
      if (Array.isArray(a)) return a;
    }
    const keys = [root.steps, root.history, root.timeline, root.items] as const;
    for (const k of keys) {
      if (Array.isArray(k)) return k;
    }
    return [];
  };

  const rows = extractArray();
  const out: ReimbursementHistoryStep[] = [];
  for (const raw of rows) {
    const o = asRecord(raw);
    if (!o) continue;
    const title =
      str(o.title) ||
      str(o.status_label) ||
      str(o.statusLabel) ||
      str(o.reimbursement_status_reason) ||
      str(o.name) ||
      str(o.step) ||
      str(o.message) ||
      "Update";
    const at =
      str(o.createdAt) ||
      str(o.created_at) ||
      str(o.date) ||
      str(o.timestamp) ||
      str(o.updatedAt) ||
      str(o.updated_at) ||
      null;
    if (title.trim()) out.push({ title: title.trim(), at: at?.trim() || null });
  }
  return out;
}

export type UpdateReimbursementBillPayload = Readonly<{
  bill_number: string;
  bill_date: string;
  bill_amount: number;
  clinic_name: string;
  clinic_address: string;
  doctor_name?: string | null;
  doctor_registration_number?: string | null;
  document_name?: string | null;
  reimbursement_bill_files: readonly ReimbursementBillFileRef[];
}>;

/** PATCH `/patient/reimbursement/bill/:billId` */
export async function updateReimbursementBill(
  billId: string,
  payload: UpdateReimbursementBillPayload,
): Promise<unknown> {
  const res = await patientFetchChecked(`reimbursement/bill/${encodeURIComponent(billId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
