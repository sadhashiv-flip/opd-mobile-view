import { patientJson } from "@/api/patientHttp";

/** GET /patient/dashboard (Bearer). Banners come from {@link fetchPatientBanners} (`GET /banners`). */

export type DashboardGymPackage = Readonly<{
  tnc?: string;
  mrp_amount?: number;
  pay_amount?: number;
  package_code?: string;
  package_name?: string;
  enable_wallet?: boolean;
  package_amount?: number;
  validity_units?: string;
  validity_value?: number;
}>;

export type PatientDashboardGym = Readonly<{
  membership?: string;
  gym_module?: boolean;
  dependents?: unknown;
  subscription_id?: string | null;
  packages?: readonly DashboardGymPackage[];
  order?: unknown;
  payment_available?: boolean;
}>;

export type PatientDashboardResponse = Readonly<{
  ahc?: boolean;
  ongoing?: unknown;
  mood?: number;
  notificationCount?: number;
  water_consumed?: number;
  calories_burnt?: number;
  jm_token?: string | null;
  gym?: PatientDashboardGym;
}>;

/** Home carousel slide; populated from `GET /banners`, not dashboard. */
export type DashboardBannerSlide = Readonly<{
  id?: string;
  image: string;
  link: string;
}>;

export type DashboardOngoingItem = Readonly<{
  id: string;
  invoiceId: string;
  type: string;
  orderType: string;
  title: string;
  meta: string;
  status: number;
}>;

export type DashboardGymState = Readonly<{
  membership: string;
  gymModule: boolean;
  paymentAvailable: boolean;
  packageName: string | null;
  subscriptionId: string | null;
  dependents: readonly string[];
}>;

function normalizeNotificationCount(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function normalizeNonNegNumber(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}

function formatPincode(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.trunc(raw));
  return "";
}

function formatAddressLines(addr: Record<string, unknown>): string | null {
  const line1 = typeof addr.line_1 === "string" ? addr.line_1.trim() : "";
  const line2 = typeof addr.line_2 === "string" ? addr.line_2.trim() : "";
  const city = typeof addr.city === "string" ? addr.city.trim() : "";
  const pin = formatPincode(addr.pincode);
  const cityPin = [city, pin].filter(Boolean).join(" ");
  const top = [line1, line2].filter(Boolean).join(", ");
  const parts = [top, cityPin].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** First formatted `details.address` found on an ongoing row (e.g. vaccine home visit). */
export function primaryAddressLineFromOngoing(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const details = (item as Record<string, unknown>).details;
    if (!details || typeof details !== "object") continue;
    const addr = (details as Record<string, unknown>).address;
    if (!addr || typeof addr !== "object") continue;
    const line = formatAddressLines(addr as Record<string, unknown>);
    if (line) return line;
  }
  return null;
}

function ongoingTitleAndMeta(
  type: string,
  orderType: string,
  details: Record<string, unknown>,
): { title: string; meta: string } {
  const ot = orderType.toUpperCase();
  if (type === "vaccine" || ot === "VACCINE") {
    const when =
      (typeof details.preferred_date_time === "string" && details.preferred_date_time.trim()) ||
      (typeof details.booking_time === "string" && details.booking_time.trim()) ||
      "";
    const req = details.request;
    let reqLabel = "";
    if (Array.isArray(req)) {
      const names = req.filter((x): x is string => typeof x === "string" && x.trim());
      reqLabel = names.join(", ");
    }
    const meta = [when, reqLabel].filter(Boolean).join(" · ");
    return { title: "Vaccination", meta };
  }

  if (typeof details.service === "string" && details.service.trim()) {
    const area =
      typeof details.service_area === "string" && details.service_area.trim()
        ? details.service_area.trim()
        : "";
    return { title: details.service.trim(), meta: area };
  }

  return {
    title: orderType || type || "Order",
    meta: "",
  };
}

function parseOngoingRow(item: unknown): DashboardOngoingItem | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const invoiceId = typeof row.invoice_id === "string" ? row.invoice_id.trim() : "";
  if (!id || !invoiceId) return null;
  const type = typeof row.type === "string" ? row.type : "";
  const orderType = typeof row.order_type === "string" ? row.order_type : "";
  const status = typeof row.status === "number" && Number.isFinite(row.status) ? row.status : -1;
  const details =
    row.details && typeof row.details === "object"
      ? (row.details as Record<string, unknown>)
      : {};
  const { title, meta } = ongoingTitleAndMeta(type, orderType, details);
  return { id, invoiceId, type, orderType, title, meta, status };
}

export function normalizeDashboardOngoing(raw: unknown): DashboardOngoingItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DashboardOngoingItem[] = [];
  for (const item of raw) {
    const row = parseOngoingRow(item);
    if (row) out.push(row);
  }
  return out;
}

function gymDependentsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const deps: string[] = [];
  for (const d of raw) {
    if (typeof d === "string" && d.trim()) deps.push(d.trim());
  }
  return deps;
}

function firstGymPackageName(packages: unknown): string | null {
  if (!Array.isArray(packages)) return null;
  for (const p of packages) {
    if (!p || typeof p !== "object") continue;
    const name = (p as Record<string, unknown>).package_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

export function normalizeDashboardGym(raw: unknown): DashboardGymState | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const membership = typeof g.membership === "string" ? g.membership : "";
  const subscriptionId =
    typeof g.subscription_id === "string" && g.subscription_id.trim()
      ? g.subscription_id.trim()
      : null;
  return {
    membership,
    gymModule: g.gym_module === true,
    paymentAvailable: g.payment_available === true,
    packageName: firstGymPackageName(g.packages),
    subscriptionId,
    dependents: gymDependentsList(g.dependents),
  };
}

export async function fetchPatientDashboard(): Promise<PatientDashboardResponse> {
  return patientJson<PatientDashboardResponse>("dashboard", {
    method: "GET",
    skipGlobalLoading: true,
  });
}

export function dashboardNotificationCount(data: PatientDashboardResponse): number {
  return normalizeNotificationCount(data.notificationCount);
}

/** Normalized fields for home / dashboard UI. */
export type PatientDashboardHomeModel = Readonly<{
  apiBanners: DashboardBannerSlide[];
  notificationCount: number;
  primaryAddressLine: string | null;
  ahc: boolean;
  ongoing: DashboardOngoingItem[];
  mood: number;
  waterConsumed: number;
  caloriesBurnt: number;
  gym: DashboardGymState | null;
  /** Video / join token when provided by API; not shown on home by default. */
  jmToken: string | null;
}>;

export function toDashboardHomeModel(data: PatientDashboardResponse): PatientDashboardHomeModel {
  const ongoingRaw = data.ongoing;
  const jm = data.jm_token;
  return {
    apiBanners: [],
    notificationCount: dashboardNotificationCount(data),
    primaryAddressLine: primaryAddressLineFromOngoing(ongoingRaw),
    ahc: data.ahc === true,
    ongoing: normalizeDashboardOngoing(ongoingRaw),
    mood: normalizeNonNegNumber(data.mood),
    waterConsumed: normalizeNonNegNumber(data.water_consumed),
    caloriesBurnt: normalizeNonNegNumber(data.calories_burnt),
    gym: normalizeDashboardGym(data.gym),
    jmToken: typeof jm === "string" && jm.trim() ? jm.trim() : null,
  };
}
