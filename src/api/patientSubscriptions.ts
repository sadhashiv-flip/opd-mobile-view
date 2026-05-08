import { fetchAllListPages, type ListPaginationOpts } from "@/api/listPagination";
import { patientFetch, patientFetchChecked, patientJsonList } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";

/** Normalized row for UI; maps common API field names. */
export type SubscriptionDisplay = Readonly<{
  id: string;
  name: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  description: string | null;
  referenceCode: string | null;
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

const NESTED_LIST_KEYS = ["subscriptions", "items", "data", "list", "plans"] as const;

function firstArrayInRecord(rec: Record<string, unknown>): unknown[] | null {
  for (const key of NESTED_LIST_KEYS) {
    const a = rec[key];
    if (Array.isArray(a)) return a;
  }
  return null;
}

function extractArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];

  const topKeys = [
    root.data,
    root.subscription,
    root.subscriptions,
    root.subscription_list,
    root.items,
    root.results,
    root.plans,
  ] as const;

  for (const c of topKeys) {
    if (Array.isArray(c)) return c;
    const inner = asRecord(c);
    if (inner) {
      const nested = firstArrayInRecord(inner);
      if (nested) return nested;
    }
  }

  const single = root.subscription ?? root.plan ?? root.active_plan;
  if (single && typeof single === "object") return [single];
  return [];
}

function normalizeOne(v: unknown, index: number): SubscriptionDisplay | null {
  const o = asRecord(v);
  if (!o) return null;

  const id =
    str(o.id) ??
    str(o.subscription_id) ??
    str(o.subscriptionId) ??
    str(o.uuid) ??
    `subscription-${index}`;

  const name =
    str(o.name) ??
    str(o.title) ??
    str(o.plan_name) ??
    str(o.planName) ??
    str(o.package_name) ??
    str(o.product_name) ??
    "Subscription";

  const status =
    str(o.status) ??
    str(o.state) ??
    str(o.subscription_status) ??
    str(o.active_status);

  const startDate =
    str(o.start_date) ??
    str(o.startDate) ??
    str(o.starts_at) ??
    str(o.valid_from) ??
    str(o.from_date);

  const endDate =
    str(o.end_date) ??
    str(o.endDate) ??
    str(o.ends_at) ??
    str(o.valid_until) ??
    str(o.expires_at) ??
    str(o.to_date);

  const renewalDate =
    str(o.renewal_date) ??
    str(o.renewalDate) ??
    str(o.next_billing_date) ??
    str(o.next_renewal);

  const description =
    str(o.description) ??
    str(o.summary) ??
    str(o.details) ??
    str(o.benefits);

  const referenceCode =
    str(o.reference_code) ??
    str(o.referenceCode) ??
    str(o.order_id) ??
    str(o.orderId);

  return {
    id,
    name,
    status,
    startDate,
    endDate,
    renewalDate,
    description,
    referenceCode,
  };
}

export function normalizeSubscriptionsResponse(body: unknown): SubscriptionDisplay[] {
  const raw = extractArray(body);
  return raw
    .map((item, i) => normalizeOne(item, i))
    .filter((x): x is SubscriptionDisplay => x != null);
}

/** GET `/subscription/plans?page=&limit=` (legacy flat list normalizer). */
export async function fetchPatientSubscriptions(
  pagination?: ListPaginationOpts,
): Promise<SubscriptionDisplay[]> {
  const raw = await patientJsonList<unknown>("subscription/plans", { method: "GET" }, pagination);
  return normalizeSubscriptionsResponse(raw);
}

/** GET `/subscription/plans?page=&limit=` — available subscription plans. */
export async function fetchSubscriptionPlans(
  pagination?: ListPaginationOpts,
): Promise<SubscriptionDisplay[]> {
  const raw = await patientJsonList<unknown>("subscription/plans", { method: "GET" }, pagination);
  return normalizeSubscriptionsResponse(raw);
}

/** Loads every page until a short or empty response. */
export async function fetchAllSubscriptionPlans(): Promise<SubscriptionDisplay[]> {
  return fetchAllListPages((opts) => fetchSubscriptionPlans(opts));
}

// —— Active subscription (GET subscription/plans — `isSubscribed` + `data[]` with `plan`, `patients`) ——

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
}

function genderInitial(g: string | null): string {
  const x = (g ?? "").trim().toLowerCase();
  if (x === "male" || x === "m") return "M";
  if (x === "female" || x === "f") return "F";
  if (x === "other" || x === "o") return "O";
  return "?";
}

function parseMemberTypeCounts(v: unknown): Record<string, number> | null {
  const r = asRecord(v);
  if (!r) return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(r)) {
    let n: number;
    if (typeof val === "number" && Number.isFinite(val)) {
      n = val;
    } else if (typeof val === "string" || typeof val === "boolean") {
      n = Number.parseInt(String(val).trim(), 10);
    } else {
      n = Number.NaN;
    }
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function formatMemberTypeLine(mt: Record<string, number> | null): string | null {
  if (!mt) return null;
  const order = ["employee", "spouse", "parent", "child"] as const;
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const k of order) {
    if (k in mt) {
      parts.push(`${k} (${mt[k]})`);
      seen.add(k);
    }
  }
  for (const k of Object.keys(mt)) {
    if (!seen.has(k)) parts.push(`${k} (${mt[k]})`);
  }
  return parts.length ? parts.join(" , ") : null;
}

/** Same ordering as patient_app `MySubscriptionsScreen._SlotList`. */
export function sortSubscriptionMemberTypeKeys(keys: readonly string[]): string[] {
  const order = ["employee", "spouse", "parent", "child"];
  return [...keys].sort((a, b) => {
    const ia = order.indexOf(a.toLowerCase());
    const ib = order.indexOf(b.toLowerCase());
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b);
  });
}

function subscriptionValidUntilDisplay(o: Record<string, unknown>): string | null {
  const explicit = str(o.expiresAt_display);
  if (explicit) return explicit;

  for (const key of [
    "expiresAt",
    "expires_at",
    "end_date",
    "valid_until",
    "subscription_end",
  ] as const) {
    const v = o[key];
    if (v == null || typeof v === "object") continue;
    const s = String(v).trim();
    if (!s) continue;
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(parsed));
    }
  }

  const daysLeft = num(o.daysLeft) ?? num(o.days_left);
  if (daysLeft != null && daysLeft >= 0) {
    const end = new Date();
    end.setDate(end.getDate() + daysLeft);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(end);
  }
  return null;
}

export type ActiveSubscriptionPatientRow = Readonly<{
  id: string;
  name: string;
  genderLabel: string;
  age: number | null;
  isActive: boolean;
  dependentType: string | null;
}>;

export type ActiveSubscriptionItem = Readonly<{
  id: string;
  daysLeft: number | null;
  planName: string;
  planAmount: number | null;
  membersCount: number | null;
  memberTypeLine: string | null;
  canActivate: boolean;
  patients: readonly ActiveSubscriptionPatientRow[];
  /** Buyer / primary purchaser — must match logged-in user to assign dependents (patient_app). */
  patientId: string | null;
  planAllowsDependentAdd: boolean;
  subscriptionStatusActive: boolean;
  validUntilDisplay: string | null;
  memberTypeCounts: Record<string, number> | null;
  assignedPatientIds: readonly string[];
}>;

export type ActiveSubscriptionsResult = Readonly<{
  isSubscribed: boolean;
  message: string | null;
  items: readonly ActiveSubscriptionItem[];
}>;

function parseActivePatientRow(v: unknown, index: number): ActiveSubscriptionPatientRow | null {
  const o = asRecord(v);
  if (!o) return null;
  const inner = asRecord(o.patient) ?? o;
  const name = str(inner.name) ?? str(o.name) ?? "Member";
  const id =
    str(o.id) ?? str(o.patient_id) ?? str(inner.id) ?? `patient-${index}`;
  const age = num(inner.age);
  const statusN = num(o.status);
  const isActive = statusN === 1 || o.active === true;
  return {
    id,
    name,
    genderLabel: genderInitial(str(inner.gender)),
    age,
    isActive,
    dependentType: str(o.dependent_type) ?? str(o.dependentType),
  };
}

function collectAssignedPatientIds(
  o: Record<string, unknown>,
  parsedPatients: readonly ActiveSubscriptionPatientRow[],
): readonly string[] {
  const ids = new Set<string>();
  const membersRaw = o.members;
  if (Array.isArray(membersRaw)) {
    for (const e of membersRaw) {
      const m = asRecord(e);
      const id = m ? str(m.id) : null;
      if (id) ids.add(id);
    }
  }
  for (const p of parsedPatients) {
    ids.add(p.id);
  }
  const patientsRaw = o.patients;
  if (Array.isArray(patientsRaw)) {
    for (const e of patientsRaw) {
      const row = asRecord(e);
      if (!row) continue;
      const pid = str(row.patient_id);
      if (pid) ids.add(pid);
      const inner = asRecord(row.patient);
      if (inner) {
        const id = str(inner.id);
        if (id) ids.add(id);
      }
    }
  }
  return [...ids];
}

function parseTruthyFlag(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes") return true;
    if (s === "0" || s === "false" || s === "no" || s === "") return false;
  }
  return false;
}

/** Plan row: `canActivate` / `can_activate` — when true, purchaser may assign members to open slots. */
function parseCanActivate(o: Record<string, unknown>): boolean {
  const raw = o.canActivate ?? o.can_activate ?? o.CanActivate;
  return parseTruthyFlag(raw);
}

function rowLooksLikeActiveSubscriptionRow(v: unknown): boolean {
  const o = asRecord(v);
  if (!o) return false;
  return asRecord(o.plan) != null;
}

/**
 * GET `/subscription/plans` may return `data`, `subscription`, `subscriptions`, etc.
 * Used only when normalizing the active-subscription payload (not the paginated catalog list).
 */
function extractActiveSubscriptionRowsFromPlansResponse(body: unknown): unknown[] | null {
  if (Array.isArray(body)) {
    if (body.length === 0) return [];
    return rowLooksLikeActiveSubscriptionRow(body[0]) ? body : null;
  }
  const root = asRecord(body);
  if (!root) return null;

  const tryArray = (a: unknown): unknown[] | null => {
    if (!Array.isArray(a)) return null;
    if (a.length === 0) return [];
    return rowLooksLikeActiveSubscriptionRow(a[0]) ? a : null;
  };

  for (const key of ["data", "subscription", "subscriptions", "items", "plans"] as const) {
    const got = tryArray(root[key]);
    if (got != null) return got;
  }
  const nested = firstArrayInRecord(root);
  if (nested) {
    const got = tryArray(nested);
    if (got != null) return got;
  }
  return null;
}

function parseActiveSubscriptionItem(v: unknown, index: number): ActiveSubscriptionItem | null {
  const o = asRecord(v);
  if (!o) return null;
  const plan = asRecord(o.plan);
  if (!plan) return null;

  const id = str(o.id) ?? str(o.purchase_id) ?? `sub-${index}`;

  const memberTypeCounts =
    parseMemberTypeCounts(plan.member_type) ?? parseMemberTypeCounts(o.member_type);
  const memberTypeLine = formatMemberTypeLine(memberTypeCounts);
  const patientsRaw = o.patients;
  const patients: ActiveSubscriptionPatientRow[] = Array.isArray(patientsRaw)
    ? patientsRaw
      .map((p, i) => parseActivePatientRow(p, i))
      .filter((x): x is ActiveSubscriptionPatientRow => x != null)
    : [];

  const statusN = num(o.status);
  const subscriptionStatusActive = statusN === 1 || o.status === true;
  const planAllowsDependentAdd = plan.dependent_add === true;
  const canActivate = parseCanActivate(o) || parseCanActivate(plan);

  return {
    id,
    daysLeft: num(o.daysLeft) ?? num(o.days_left),
    planName: str(plan.name) ?? "Subscription",
    planAmount: num(plan.amount),
    membersCount: num(plan.members),
    memberTypeLine,
    canActivate,
    patients,
    patientId: str(o.patient_id),
    planAllowsDependentAdd,
    subscriptionStatusActive,
    validUntilDisplay: subscriptionValidUntilDisplay(o),
    memberTypeCounts,
    assignedPatientIds: collectAssignedPatientIds(o, patients),
  };
}

function legacyItemsToActive(items: SubscriptionDisplay[]): ActiveSubscriptionItem[] {
  return items.map((s) => ({
    id: s.id,
    daysLeft: null,
    planName: s.name,
    planAmount: null,
    membersCount: null,
    memberTypeLine: s.description,
    canActivate: false,
    patients: [],
    patientId: null,
    planAllowsDependentAdd: false,
    subscriptionStatusActive: false,
    validUntilDisplay: s.endDate,
    memberTypeCounts: null,
    assignedPatientIds: [],
  }));
}

/** Normalizes GET `/subscription/plans` (active plans + patients) or legacy list shapes. */
export function parseActiveSubscriptionsResponse(body: unknown): ActiveSubscriptionsResult {
  const activeRows = extractActiveSubscriptionRowsFromPlansResponse(body);
  if (activeRows != null) {
    const root = asRecord(body);
    const message = root ? str(root.message) : null;
    const isSubscribedFlag = root ? parseTruthyFlag(root.isSubscribed) : false;
    const items = activeRows
      .map((row, i) => parseActiveSubscriptionItem(row, i))
      .filter((x): x is ActiveSubscriptionItem => x != null);
    return {
      isSubscribed: isSubscribedFlag || items.length > 0,
      message,
      items,
    };
  }

  const root = asRecord(body);
  if (!root) {
    return { isSubscribed: false, message: null, items: [] };
  }

  const message = str(root.message);
  const isSubscribedFlag = parseTruthyFlag(root.isSubscribed);

  const legacy = normalizeSubscriptionsResponse(body);
  return {
    isSubscribed: isSubscribedFlag || legacy.length > 0,
    message,
    items: legacyItemsToActive(legacy),
  };
}

/** GET `/subscription/plans` — active subscription(s), `patients`, `plan`, `daysLeft`, etc. (not paginated; full dashboard payload). */
export async function fetchActiveSubscriptions(): Promise<ActiveSubscriptionsResult> {
  const path = "subscription/plans";
  const res = await patientFetch(path, { method: "GET" });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }

  // Backend may return 204 for "no active subscriptions" on this endpoint.
  if (res.status === 204) {
    return { isSubscribed: false, message: null, items: [] };
  }

  const text = await res.text();
  if (!text?.trim()) {
    return { isSubscribed: false, message: null, items: [] };
  }

  try {
    const raw = JSON.parse(text) as unknown;
    return parseActiveSubscriptionsResponse(raw);
  } catch {
    const preview = text.replaceAll(/\s+/g, " ").slice(0, 200);
    throw new Error(
      `Invalid JSON (HTTP ${res.status}) for ${path}: ${preview || "(empty after trim)"}`,
    );
  }
}

/**
 * POST `/patient/subscription/activate` — assign a family member to a plan slot (patient_app
 * `SubscriptionRepository.activateMemberOnPlan`).
 */
export async function activateMemberOnPlan(params: Readonly<{
  memberId: number;
  subscriptionId: string;
  dependentType: string;
}>): Promise<void> {
  const res = await patientFetchChecked("subscription/activate", {
    method: "POST",
    body: JSON.stringify({
      member_id: params.memberId,
      subscription_id: params.subscriptionId,
      dependent_type: params.dependentType,
    }),
  });
  await res.text();
}
