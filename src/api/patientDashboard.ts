import { patientJson } from "@/api/patientHttp";
import {
  displayCategoryFromTx,
  friendlyWhenLine,
  mapOngoingStatusLabel,
  memberCountFromRow,
  orderCategoryKeyFromDisplayCategory,
  patientNameFromRow,
  transactionTypeFromRow,
  visitTypeLabelFromRow,
} from "@/lib/dashboardOngoingDisplay";

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
  /** May be empty; home carousel banners usually come from `GET /banners`. */
  banners?: unknown;
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
  /** True when `order_type` is APPOINTMENT and `communication` is ONLINE (video consult). */
  canJoinVideoCall: boolean;
  /** Dashboard tile — same idea as Flutter `Order.type`. */
  displayCategory: string;
  /** Human-readable status chip (Flutter `_mapStatus`). */
  statusLabel: string;
  patientLine: string;
  memberCount: number;
  whenLine: string;
  visitTypeLabel: string | null;
  orderCategoryIconKey: string;
}>;

export type DashboardGymState = Readonly<{
  membership: string;
  gymModule: boolean;
  paymentAvailable: boolean;
  packageName: string | null;
  subscriptionId: string | null;
  dependents: readonly string[];
}>;

function normalizeBoolean(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false || raw == null) return false;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw !== "string") return false;
  const text = raw.trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizeNonNegNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === "string") {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function normalizeNonNegInteger(raw: unknown): number {
  const value = normalizeNonNegNumber(raw);
  return Math.floor(value);
}

function normalizeString(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw).trim();
  return "";
}

function normalizeNotificationCount(raw: unknown): number {
  return normalizeNonNegInteger(raw);
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

const CONSULTATION_META_PURPOSE_MAX = 72;

function truncateMetaSegment(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

/** Virtual / clinic consultation rows: `order_type` APPOINTMENT, `doctor`, `purpose`, `additional_info.booking_details`. */
function consultationNameFields(row: Record<string, unknown>): { doctorName: string; specialityName: string } {
  const doc = row.doctor;
  let doctorName = "";
  let specialityName = "";
  if (doc && typeof doc === "object") {
    const d = doc as Record<string, unknown>;
    doctorName = typeof d.name === "string" ? d.name.trim() : "";
    const spec = d.speciality;
    if (spec && typeof spec === "object") {
      const n = (spec as Record<string, unknown>).name;
      specialityName = typeof n === "string" ? n.trim() : "";
    }
  }
  return { doctorName, specialityName };
}

function consultationSlotTime(row: Record<string, unknown>): string {
  const add = row.additional_info;
  if (add && typeof add === "object") {
    const bd = (add as Record<string, unknown>).booking_details;
    if (bd && typeof bd === "object") {
      const ts = (bd as Record<string, unknown>).time_slot;
      if (typeof ts === "string" && ts.trim()) return ts.trim();
    }
  }

  const d = typeof row.date === "string" ? row.date.trim() : "";
  const t = typeof row.time === "string" ? row.time.trim() : "";
  return d && t ? `${d} ${t}` : d || t;
}

function consultationSpecialtiesLabel(row: Record<string, unknown>): string {
  const add = row.additional_info;
  if (add && typeof add === "object") {
    const bd = (add as Record<string, unknown>).booking_details;
    if (bd && typeof bd === "object") {
      const specs = (bd as Record<string, unknown>).specialties;
      if (Array.isArray(specs)) {
        const names = specs.filter((x): x is string => typeof x === "string" && x.trim() !== "");
        return names.join(", ");
      }
    }
  }
  return "";
}

function consultationBookingMeta(row: Record<string, unknown>): { timeSlot: string; specialtiesLabel: string } {
  return {
    timeSlot: consultationSlotTime(row),
    specialtiesLabel: consultationSpecialtiesLabel(row),
  };
}

function consultationTitleAndMeta(row: Record<string, unknown>): { title: string; meta: string } {
  const { doctorName, specialityName } = consultationNameFields(row);
  const title =
    doctorName ||
    specialityName ||
    (typeof row.communication === "string" && row.communication.toUpperCase() === "ONLINE"
      ? "Online consultation"
      : "Consultation");

  const { timeSlot, specialtiesLabel } = consultationBookingMeta(row);
  const purposeRaw = typeof row.purpose === "string" ? row.purpose.trim() : "";
  const purpose =
    purposeRaw.length > 0 ? truncateMetaSegment(purposeRaw, CONSULTATION_META_PURPOSE_MAX) : "";
  const language = typeof row.language === "string" ? row.language.trim() : "";

  const metaParts = [
    timeSlot,
    specialtiesLabel || specialityName || "",
    purpose,
    language,
  ].filter(Boolean);
  const meta = metaParts.join(" · ");

  return { title, meta };
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
      const names = req.filter((x): x is string => typeof x === "string" && x.trim() !== "");
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

function parseStringOrRawField(row: Record<string, unknown>, keys: Array<string | number>): string {
  for (const key of keys) {
    const value = row[key as keyof typeof row];
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function parseOngoingRow(item: unknown): DashboardOngoingItem | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const id = parseStringOrRawField(row, ["id"]);
  const invoiceId = parseStringOrRawField(row, ["invoice_id", "invoiceId", "id"]);
  if (!id || !invoiceId) return null;
  const type = parseStringOrRawField(row, ["type", "transaction_type", "transactionType", "service_type", "serviceType", "category"]);
  const orderType = parseStringOrRawField(row, ["order_type", "transaction_type", "transactionType", "service_type", "serviceType"]);
  const statusRaw = row.status;
  const status = typeof statusRaw === "number" && Number.isFinite(statusRaw) ? statusRaw : -1;
  const comm = parseStringOrRawField(row, ["communication"]).toUpperCase();
  const canJoinVideoCall = orderType.toUpperCase() === "APPOINTMENT" && comm === "ONLINE";
  const details =
    row.details && typeof row.details === "object"
      ? (row.details as Record<string, unknown>)
      : {};
  const ot = orderType.toUpperCase();
  const { title, meta } =
    ot === "APPOINTMENT"
      ? consultationTitleAndMeta(row)
      : ongoingTitleAndMeta(type, orderType, details);

  const rawInfo =
    row.info && typeof row.info === "object"
      ? (row.info as Record<string, unknown>)
      : row.invoice && typeof row.invoice === "object"
        ? (row.invoice as Record<string, unknown>)
        : {};
  const tx = transactionTypeFromRow(row);
  const displayCategory = displayCategoryFromTx(tx);
  const statusLabel = mapOngoingStatusLabel(row, rawInfo, tx);
  const memberCount = Math.max(1, memberCountFromRow(row, rawInfo));
  const patientName = patientNameFromRow(row, rawInfo, memberCount);
  const patientLine = `For ${patientName}`;
  const whenLine = friendlyWhenLine(row, rawInfo);
  const visitTypeLabel = visitTypeLabelFromRow(row);

  return {
    id,
    invoiceId,
    type,
    orderType,
    title,
    meta,
    status,
    canJoinVideoCall,
    displayCategory,
    statusLabel,
    patientLine,
    memberCount,
    whenLine,
    visitTypeLabel,
    orderCategoryIconKey: orderCategoryKeyFromDisplayCategory(displayCategory),
  };
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
  const membership = normalizeString(g.membership);
  const subscriptionId = normalizeString(g.subscription_id) || null;
  return {
    membership,
    gymModule: normalizeBoolean(g.gym_module),
    paymentAvailable: normalizeBoolean(g.payment_available),
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
  /** Home carousel — promo banners only (see `normalizePatientBannersPayload`). */
  apiBanners: DashboardBannerSlide[];
  /** Annual Health Checkup card strip — from AHC-tagged / dedicated banner lists. */
  ahcBanners: DashboardBannerSlide[];
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
    ahcBanners: [],
    notificationCount: dashboardNotificationCount(data),
    primaryAddressLine: primaryAddressLineFromOngoing(ongoingRaw),
    ahc: normalizeBoolean(data.ahc),
    ongoing: normalizeDashboardOngoing(ongoingRaw),
    mood: normalizeNonNegNumber(data.mood),
    waterConsumed: normalizeNonNegNumber(data.water_consumed),
    caloriesBurnt: normalizeNonNegNumber(data.calories_burnt),
    gym: normalizeDashboardGym(data.gym),
    jmToken: normalizeString(jm) || null,
  };
}
