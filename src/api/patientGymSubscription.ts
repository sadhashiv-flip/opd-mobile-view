/**
 * Gym subscription flow aligned with patient-app:
 * `GET gym/packages`, `GET gym/eligibility`, `POST gym/quote`,
 * `POST gym/optIn` with `{ subscription_id, lines }`.
 */
import { readAppointmentPaymentLayer } from "@/api/appointmentBook";
import { readPatientApiError } from "@/api/patientClient";
import { patientFetch, patientJson } from "@/api/patientHttp";
import {
  parseGymOptInResponse,
  type GymOptInPhase,
  type GymOptInResult,
} from "@/api/patientGym";

function gymOptInPath(): string {
  const p = import.meta.env.VITE_GYM_OPTIN_PATH?.trim();
  return p && p.length > 0 ? p.replace(/^\//, "") : "gym/optIn";
}

function statusOk(map: Record<string, unknown>): boolean {
  const status = map.status;
  return (
    status === true ||
    status === 1 ||
    String(status).toLowerCase() === "true" ||
    String(status) === "1" ||
    (status == null && map.data != null)
  );
}

function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v.trim());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function asInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) return Number.parseInt(v.trim(), 10) || 0;
  return 0;
}

export type GymLocationPricing = Readonly<{
  locationKey: string;
  finalAmount: number;
}>;

export type GymEmployeePackage = Readonly<{
  packageCode: string;
  packageName: string;
  validityValue: number;
  validityUnits: string;
  payAmount: number;
  enableWallet: boolean;
  mrpAmount: number;
}>;

export type GymDependentPackage = Readonly<{
  packageCode: string;
  packageName: string;
  validityValue: number;
  validityUnits: string;
  payAmount: number;
  pricing: readonly GymLocationPricing[];
}>;

export type GymSubscriptionRow = Readonly<{
  subscriptionId: string;
  membership: string;
  paymentAvailable: boolean;
  forDependents: boolean;
  dependents: readonly string[];
  serviceableLocations: readonly string[];
  employeePackages: readonly GymEmployeePackage[];
  dependentPackages: readonly GymDependentPackage[];
}>;

export type GymEligibilityMember = Readonly<{
  memberId: number;
  canBuy: boolean;
  reason: string;
  message: string;
}>;

export type GymEligibilityData = Readonly<{
  subscriptionId: string;
  gymModuleActive: boolean;
  members: readonly GymEligibilityMember[];
}>;

export type GymQuoteLine = Readonly<{
  memberId: number;
  memberType: string;
  isEmployee: boolean;
  packageCode: string;
  /** From nested `package_details` when present. */
  packageName: string;
  locationKey: string;
  packageAmount: number;
  pendingAmount: number;
  paymentRequired: boolean;
  walletApplicable: boolean;
}>;

export type GymQuoteOverview = Readonly<{
  lineCount: number;
  totalPackageAmount: number;
  totalPayAmount: number;
  totalPendingAmount: number;
  totalOpdPaidAmount: number;
  paymentRequired: boolean;
  amountRequiredForPayment: number;
}>;

export type GymQuoteData = Readonly<{
  subscriptionId: string;
  lines: readonly GymQuoteLine[];
  overview: GymQuoteOverview;
}>;

export type GymOptInLineResult = Readonly<{
  memberId: number;
  packageCode: string;
  packageAmount: number;
  pendingAmount: number;
  paymentRequired: boolean;
}>;

export type GymOptInOverview = Readonly<{
  optInAmount: number;
  totalPendingAmount: number;
  paymentRequired: boolean;
}>;

export type GymOptInPreviewData = Readonly<{
  batch: boolean;
  lines: readonly GymOptInLineResult[];
  overview: GymOptInOverview;
}>;

export type GymOptInLinePayload = Readonly<{
  member_id: number;
  package_code: string;
  location: string;
  name: string;
  phone: string;
  email?: string;
  personal_email: string;
}>;

/** `POST gym/quote` — lines match Dart `GymLineFormState.toQuoteLine()`. */
export type GymQuoteLineRequest = Readonly<{
  member_id: number;
  package_code: string;
  location: string;
}>;

export type GymQuoteRequestBody = Readonly<{
  subscription_id: string;
  lines: readonly GymQuoteLineRequest[];
}>;

export type GymOptInMultiBody = Readonly<{
  subscription_id: string;
  lines: readonly GymOptInLinePayload[];
}>;

function parseLocationPricing(raw: Record<string, unknown>): GymLocationPricing {
  return {
    locationKey: String(raw.location_key ?? ""),
    finalAmount: asNum(raw.final_amount),
  };
}

function parseEmployeePackage(raw: Record<string, unknown>): GymEmployeePackage {
  return {
    packageCode: String(raw.package_code ?? ""),
    packageName: String(raw.package_name ?? raw.package_code ?? ""),
    validityValue: asInt(raw.validity_value),
    validityUnits: String(raw.validity_units ?? ""),
    payAmount: asNum(raw.pay_amount),
    enableWallet: raw.enable_wallet === true || raw.enable_wallet === 1,
    mrpAmount: asNum(raw.mrp_amount),
  };
}

function parseDependentPackage(raw: Record<string, unknown>): GymDependentPackage {
  const pr = raw.pricing;
  const pricing: GymLocationPricing[] = [];
  if (Array.isArray(pr)) {
    for (const p of pr) {
      if (p && typeof p === "object") {
        pricing.push(parseLocationPricing(p as Record<string, unknown>));
      }
    }
  }
  return {
    packageCode: String(raw.package_code ?? ""),
    packageName: String(raw.package_name ?? raw.package_code ?? ""),
    validityValue: asInt(raw.validity_value),
    validityUnits: String(raw.validity_units ?? ""),
    payAmount: asNum(raw.pay_amount),
    pricing,
  };
}

function parseSubscriptionRow(raw: Record<string, unknown>): GymSubscriptionRow {
  const deps = raw.dependents;
  const locs = raw.serviceable_locations;
  const ep = raw.employee_packages;
  const dp = raw.dependent_packages;

  return {
    subscriptionId: String(raw.subscription_id ?? ""),
    membership: String(raw.membership ?? ""),
    paymentAvailable: raw.payment_available === true || raw.payment_available === 1,
    forDependents: raw.forDependents === true || raw.forDependents === 1,
    dependents: Array.isArray(deps) ? deps.map((e) => String(e)) : [],
    serviceableLocations: Array.isArray(locs) ? locs.map((e) => String(e)) : [],
    employeePackages: Array.isArray(ep)
      ? ep
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map((x) => parseEmployeePackage(x))
      : [],
    dependentPackages: Array.isArray(dp)
      ? dp
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map((x) => parseDependentPackage(x))
      : [],
  };
}

export async function fetchGymPackages(): Promise<readonly GymSubscriptionRow[]> {
  const raw = await patientJson<unknown>("gym/packages", { method: "GET" });
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid gym packages response");
  }
  const map = raw as Record<string, unknown>;
  if (!statusOk(map)) {
    throw new Error(String(map.message ?? "Failed to load gym packages"));
  }
  const data = map.data;
  if (!Array.isArray(data)) {
    throw new Error("Invalid gym packages data");
  }
  return data
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((x) => parseSubscriptionRow(x));
}

export async function fetchGymEligibility(subscriptionId: string): Promise<GymEligibilityData> {
  const raw = await patientJson<unknown>(
    `gym/eligibility?subscription_id=${encodeURIComponent(subscriptionId)}`,
    { method: "GET" },
  );
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid gym eligibility response");
  }
  const map = raw as Record<string, unknown>;
  if (!statusOk(map)) {
    throw new Error(String(map.message ?? "Failed to load gym eligibility"));
  }
  const data = map.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid gym eligibility data");
  }
  const d = data as Record<string, unknown>;
  const mem = d.members;
  const members: GymEligibilityMember[] = [];
  if (Array.isArray(mem)) {
    for (const m of mem) {
      if (!m || typeof m !== "object") continue;
      const o = m as Record<string, unknown>;
      members.push({
        memberId: asInt(o.member_id),
        canBuy: o.can_buy === true || o.can_buy === 1,
        reason: String(o.reason ?? ""),
        message: String(o.message ?? ""),
      });
    }
  }
  return {
    subscriptionId: String(d.subscription_id ?? subscriptionId),
    gymModuleActive: d.gym_module_active === true || d.gym_module_active === 1,
    members,
  };
}

function parseQuoteLine(raw: Record<string, unknown>): GymQuoteLine {
  const pd = raw.package_details;
  let packageName = "";
  if (pd && typeof pd === "object") {
    packageName = String((pd as Record<string, unknown>).package_name ?? "");
  }
  return {
    memberId: asInt(raw.member_id),
    memberType: String(raw.member_type ?? ""),
    isEmployee: raw.is_employee === true || raw.is_employee === 1,
    packageCode: String(raw.package_code ?? ""),
    packageName,
    locationKey: String(raw.location_key ?? ""),
    packageAmount: asNum(raw.package_amount),
    pendingAmount: asNum(raw.pending_amount),
    paymentRequired: raw.payment_required === true || raw.payment_required === 1,
    walletApplicable: raw.wallet_applicable === true || raw.wallet_applicable === 1,
  };
}

function parseQuoteOverview(raw: Record<string, unknown>): GymQuoteOverview {
  return {
    lineCount: asInt(raw.line_count),
    totalPackageAmount: asNum(raw.total_package_amount),
    totalPayAmount: asNum(raw.total_pay_amount),
    totalPendingAmount: asNum(raw.total_pending_amount),
    totalOpdPaidAmount: asNum(raw.total_opd_paid_amount),
    paymentRequired: raw.payment_required === true || raw.payment_required === 1,
    amountRequiredForPayment: asNum(raw.amount_required_for_payment),
  };
}

export async function postGymQuote(body: GymQuoteRequestBody): Promise<GymQuoteData> {
  const res = await patientFetch("gym/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Invalid JSON from gym quote");
    }
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid gym quote response");
  }
  const map = raw as Record<string, unknown>;
  if (!statusOk(map)) {
    throw new Error(String(map.message ?? "Quote request failed"));
  }
  const data = map.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid quote data");
  }
  const d = data as Record<string, unknown>;
  const linesRaw = d.lines;
  const lines: GymQuoteLine[] = [];
  if (Array.isArray(linesRaw)) {
    for (const line of linesRaw) {
      if (line && typeof line === "object") {
        lines.push(parseQuoteLine(line as Record<string, unknown>));
      }
    }
  }
  const ov = d.overview;
  const overview =
    ov && typeof ov === "object"
      ? parseQuoteOverview(ov as Record<string, unknown>)
      : {
          lineCount: 0,
          totalPackageAmount: 0,
          totalPayAmount: 0,
          totalPendingAmount: 0,
          totalOpdPaidAmount: 0,
          paymentRequired: false,
          amountRequiredForPayment: 0,
        };

  return {
    subscriptionId: String(d.subscription_id ?? body.subscription_id),
    lines,
    overview,
  };
}

function parseOptInPreviewLayer(layer: Record<string, unknown>): GymOptInPreviewData | null {
  const ov = layer.overview;
  const linesRaw = layer.lines;
  if (!ov || typeof ov !== "object") return null;
  const o = ov as Record<string, unknown>;
  const lines: GymOptInLineResult[] = [];
  if (Array.isArray(linesRaw)) {
    for (const row of linesRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      lines.push({
        memberId: asInt(r.member_id),
        packageCode: String(r.package_code ?? ""),
        packageAmount: asNum(r.package_amount),
        pendingAmount: asNum(r.pending_amount),
        paymentRequired: r.payment_required === true || r.payment_required === 1,
      });
    }
  }
  return {
    batch: layer.batch === true || layer.batch === 1,
    lines,
    overview: {
      optInAmount: asNum(o.opt_in_amount),
      totalPendingAmount: asNum(o.total_pending_amount),
      paymentRequired: o.payment_required === true || o.payment_required === 1,
    },
  };
}

/** Preview totals from `POST gym/optIn` (no confirm) with multi-line body. */
export async function postGymOptInMultiPreview(
  body: GymOptInMultiBody,
): Promise<Readonly<{ payment: GymOptInResult; preview: GymOptInPreviewData | null }>> {
  const base = gymOptInPath();
  const res = await patientFetch(base, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Invalid JSON from gym opt-in preview");
    }
  }
  const layer = readAppointmentPaymentLayer(raw);
  const payment = parseGymOptInResponse(raw, "quote" as GymOptInPhase);
  const preview = parseOptInPreviewLayer(layer);
  return { payment, preview };
}

/** Confirm opt-in with multi-line body (`POST gym/optIn?status=confirm`). */
export async function postGymOptInMultiConfirm(body: GymOptInMultiBody): Promise<GymOptInResult> {
  const base = gymOptInPath();
  const path = `${base}?status=confirm`;
  const res = await patientFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Invalid JSON from gym opt-in confirm");
    }
  }
  return parseGymOptInResponse(raw, "confirm");
}

export function displayQuotePackageName(line: GymQuoteLine): string {
  const n = line.packageName?.trim();
  if (n) return n;
  return line.packageCode;
}
