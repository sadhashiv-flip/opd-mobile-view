import { fetchAllListPages, type ListPaginationOpts } from "@/api/listPagination";
import { patientJson, patientJsonList } from "@/api/patientHttp";

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
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function formatMemberTypeLine(mt: Record<string, number> | null): string | null {
  if (!mt) return null;
  const order = ["child", "employee", "spouse"] as const;
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

function parseActiveSubscriptionItem(v: unknown, index: number): ActiveSubscriptionItem | null {
  const o = asRecord(v);
  if (!o) return null;
  const plan = asRecord(o.plan);
  if (!plan) return null;

  const id = str(o.id) ?? str(o.purchase_id) ?? `sub-${index}`;

  const memberTypeLine = formatMemberTypeLine(parseMemberTypeCounts(o.member_type));
  const patientsRaw = o.patients;
  const patients: ActiveSubscriptionPatientRow[] = Array.isArray(patientsRaw)
    ? patientsRaw
      .map((p, i) => parseActivePatientRow(p, i))
      .filter((x): x is ActiveSubscriptionPatientRow => x != null)
    : [];

  return {
    id,
    daysLeft: num(o.daysLeft) ?? num(o.days_left),
    planName: str(plan.name) ?? "Subscription",
    planAmount: num(plan.amount),
    membersCount: num(plan.members),
    memberTypeLine,
    canActivate: o.canActivate === true,
    patients,
  };
}

function isNewSubscriptionShape(body: unknown): boolean {
  const root = asRecord(body);
  if (!root || !Array.isArray(root.data)) return false;
  if (root.data.length === 0) return true;
  const first = asRecord(root.data[0]);
  return first != null && asRecord(first.plan) != null;
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
  }));
}

/** Normalizes GET /subscription body (active plans + patients) or legacy list shapes. */
export function parseActiveSubscriptionsResponse(body: unknown): ActiveSubscriptionsResult {
  const root = asRecord(body);
  if (!root) {
    return { isSubscribed: false, message: null, items: [] };
  }

  const message = str(root.message);
  const isSubscribed = root.isSubscribed === true;

  if (isNewSubscriptionShape(body)) {
    const data = root.data as unknown[];
    const items = data
      .map((row, i) => parseActiveSubscriptionItem(row, i))
      .filter((x): x is ActiveSubscriptionItem => x != null);
    return {
      isSubscribed: isSubscribed || items.length > 0,
      message,
      items,
    };
  }

  const legacy = normalizeSubscriptionsResponse(body);
  return {
    isSubscribed: legacy.length > 0,
    message,
    items: legacyItemsToActive(legacy),
  };
}

/** GET `/subscription/plans` — active subscription(s), `patients`, `plan`, `daysLeft`, etc. (not paginated; full dashboard payload). */
export async function fetchActiveSubscriptions(): Promise<ActiveSubscriptionsResult> {
  const raw = await patientJson<unknown>("subscription/plans", { method: "GET" });
  return parseActiveSubscriptionsResponse(raw);
}
