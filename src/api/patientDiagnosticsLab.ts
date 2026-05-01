import { patientJson } from "@/api/patientHttp";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function nonEmptyStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** GET `/diagnostics/packages` — Individual lab catalogue (`loc` = address id). */
export type DiagnosticCatalogRow = Readonly<{
  id: number;
  name: string;
  type: string;
  category: string;
  fastingTime: number | null;
  tat: number | null;
}>;

export async function fetchDiagnosticPackages(params: Readonly<{
  loc: string;
  name?: string;
  page?: number;
  limit?: number;
}>): Promise<readonly DiagnosticCatalogRow[]> {
  const q = new URLSearchParams();
  q.set("loc", params.loc.trim());
  if (params.name?.trim()) q.set("name", params.name.trim());
  q.set("page", String(params.page ?? 1));
  q.set("limit", String(params.limit ?? 20));
  const raw = await patientJson<unknown>(`diagnostics/packages?${q.toString()}`, { method: "GET" });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const data = (raw as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  const out: DiagnosticCatalogRow[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id = num(o.id);
    if (id == null) continue;
    out.push({
      id,
      name: str(o.name) || "Test",
      type: str(o.type) || "test",
      category: str(o.category) || "pathology",
      fastingTime: num(o.fasting_time),
      tat: num(o.tat),
    });
  }
  return out;
}

export type DiagnosticVendorPackageLine = Readonly<{
  id: number;
  name: string;
  b2cPrice: number | null;
  parameterCount: number | null;
}>;

export type DiagnosticVendorPricingRow = Readonly<{
  id: number;
  name: string;
  code: string;
  logo: string | null;
  packages: readonly DiagnosticVendorPackageLine[];
}>;

/** POST `/diagnostics/packages/pricing` — Uses server lab cart for the address. */
export async function fetchDiagnosticVendorsPricing(addressId: string): Promise<readonly DiagnosticVendorPricingRow[]> {
  const raw = await patientJson<unknown>("diagnostics/packages/pricing", {
    method: "POST",
    body: JSON.stringify({ address_id: addressId.trim() }),
  });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const data = (raw as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  const vendors: DiagnosticVendorPricingRow[] = [];
  for (const v of data) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const id = num(o.id);
    if (id == null) continue;
    const packagesRaw = o.packages;
    const packages: DiagnosticVendorPackageLine[] = [];
    if (Array.isArray(packagesRaw)) {
      for (const p of packagesRaw) {
        if (!p || typeof p !== "object" || Array.isArray(p)) continue;
        const pr = p as Record<string, unknown>;
        const pid = num(pr.id);
        if (pid == null) continue;
        const pricing = pr.pricing && typeof pr.pricing === "object" && !Array.isArray(pr.pricing)
          ? (pr.pricing as Record<string, unknown>)
          : null;
        packages.push({
          id: pid,
          name: str(pr.name) || "Package",
          b2cPrice: pricing ? num(pricing.b2c_price) : null,
          parameterCount: pricing ? num(pricing.parameter_count) : null,
        });
      }
    }
    vendors.push({
      id,
      name: str(o.name) || "Lab",
      code: str(o.code) || "",
      logo: typeof o.logo === "string" ? o.logo : null,
      packages,
    });
  }
  return vendors;
}

// --- Health checkup packages (`GET …/diagnostics/packages?user=&type=&sponsored=`) ---

export type HealthCheckupPackageRow = Readonly<{
  id: number;
  /** `pricing.id` from package row — used for `GET …/diagnostics/packages/{id}` inclusions (Flutter `openPackageInclusions`). */
  pricingId: number | null;
  name: string;
  type: string;
  category: string;
  fastingTime: number | null;
  tat: number | null;
}>;

/** Special / AHC packages for a member — same query shape as patient_app `getPackages`. */
export async function fetchHealthCheckupPackages(params: Readonly<{
  userId: number;
  type?: string;
  sponsored?: boolean;
}>): Promise<readonly HealthCheckupPackageRow[]> {
  const q = new URLSearchParams();
  q.set("user", String(params.userId));
  q.set("type", (params.type ?? "special").trim() || "special");
  q.set("sponsored", params.sponsored === true ? "true" : "false");
  const raw = await patientJson<unknown>(`diagnostics/packages?${q.toString()}`, { method: "GET" });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const data = (raw as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  const out: HealthCheckupPackageRow[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id = num(o.id);
    if (id == null) continue;
    const pricing = asRecord(o.pricing);
    const pricingIdRaw = pricing != null ? num(pricing.id) : null;
    out.push({
      id,
      pricingId: pricingIdRaw != null && pricingIdRaw > 0 ? pricingIdRaw : null,
      name: str(o.name) || "Package",
      type: str(o.type) || "special",
      category: str(o.category) || "pathology",
      fastingTime: num(o.fasting_time),
      tat: num(o.tat),
    });
  }
  return out;
}

export type DiagnosticsPackageInclusionGroup = Readonly<{
  name: string;
  lines: readonly string[];
}>;

/** `GET /patient/diagnostics/packages/{pricingId}` → `data.parameters` (Flutter `PackageInclusionsScreen`). */
export async function fetchDiagnosticsPackageInclusions(
  pricingId: number,
): Promise<readonly DiagnosticsPackageInclusionGroup[]> {
  if (!Number.isFinite(pricingId) || pricingId <= 0) return [];
  const raw = await patientJson<unknown>(`diagnostics/packages/${pricingId}`, { method: "GET" });
  const root = asRecord(raw);
  const data = root != null ? asRecord(root.data) : null;
  const parameters = data != null && Array.isArray(data.parameters) ? data.parameters : [];
  const out: DiagnosticsPackageInclusionGroup[] = [];
  for (const row of parameters) {
    const m = asRecord(row);
    if (!m) continue;
    const nameRaw = m.name;
    const name =
      typeof nameRaw === "string" && nameRaw.trim()
        ? nameRaw.trim()
        : typeof nameRaw === "number" || typeof nameRaw === "boolean"
          ? String(nameRaw)
          : "—";
    const detailRaw = m.package_detail;
    const lines: string[] = [];
    if (Array.isArray(detailRaw)) {
      for (const d of detailRaw) {
        if (typeof d === "string" || typeof d === "number" || typeof d === "boolean") {
          const s = String(d).trim();
          if (s) lines.push(s);
        } else {
          const dr = asRecord(d);
          if (dr) {
            const label = str(dr.name) ?? str(dr.title);
            const val = str(dr.value) ?? str(dr.description);
            if (label && val) lines.push(`${label}: ${val}`);
            else if (label) lines.push(label);
            else if (val) lines.push(val);
          }
        }
      }
    }
    out.push({ name, lines });
  }
  return out;
}

export type HealthSponsoredVendorRow = Readonly<{
  id: number;
  name: string;
  code: string;
  logo: string | null;
  category: string;
  price: number;
}>;

export type SponsoredVendorPricingResult = Readonly<{
  pathologyVendors: readonly HealthSponsoredVendorRow[];
  radiologyVendors: readonly HealthSponsoredVendorRow[];
  pathologyCategoryExists: boolean;
  radiologyCategoryExists: boolean;
}>;

function vendorPayloadExists(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.length > 0;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return Object.keys(raw as object).length > 0;
  return false;
}

function parseSponsoredVendorMaps(raw: unknown): Record<string, unknown>[] {
  const maps: Record<string, unknown>[] = [];
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (e && typeof e === "object" && !Array.isArray(e)) maps.push(e as Record<string, unknown>);
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    maps.push(raw as Record<string, unknown>);
  }
  return maps;
}

function parseHealthSponsoredVendorList(raw: unknown): HealthSponsoredVendorRow[] {
  const out: HealthSponsoredVendorRow[] = [];
  for (const json of parseSponsoredVendorMaps(raw)) {
    const code = str(json.code);
    if (code === "unknown") continue;
    const id = num(json.id) ?? 0;
    out.push({
      id,
      name: str(json.name) || "Lab",
      code,
      logo: typeof json.logo === "string" ? json.logo : null,
      category: str(json.category) || "",
      price: num(json.price) ?? 0,
    });
  }
  return out;
}

/** POST `/diagnostics/sponsored/pricing?page=1` — health checkup vendor matrix (pathology / radiology). */
export async function fetchSponsoredVendorPricing(params: Readonly<{
  addressId: string;
  sponsored: boolean;
  users: readonly { user_id: number; packages: readonly number[] }[];
}>): Promise<SponsoredVendorPricingResult> {
  const raw = await patientJson<unknown>("diagnostics/sponsored/pricing?page=1", {
    method: "POST",
    body: JSON.stringify({
      address_id: params.addressId.trim(),
      sponsored: params.sponsored,
      users: params.users.map((u) => ({
        user_id: u.user_id,
        packages: [...u.packages],
      })),
    }),
  });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      pathologyVendors: [],
      radiologyVendors: [],
      pathologyCategoryExists: false,
      radiologyCategoryExists: false,
    };
  }
  const root = raw as Record<string, unknown>;
  const rawPath = root.pathology_vendor;
  const rawRad = root.radiology_vendor;
  return {
    pathologyVendors: parseHealthSponsoredVendorList(rawPath),
    radiologyVendors: parseHealthSponsoredVendorList(rawRad),
    pathologyCategoryExists: vendorPayloadExists(rawPath),
    radiologyCategoryExists: vendorPayloadExists(rawRad),
  };
}

export type DiagnosticSlotPick = Readonly<{
  slot_id: string;
  vendor_code: string;
  slot_date: string;
  start_time: string;
  end_time: string;
}>;

/** POST `/diagnostics/slots` — `package` `"test"` for lab cart; `"special"` + optional `category` for health checkups. */
export async function fetchDiagnosticSlots(body: Readonly<{
  address_id: string;
  date: string;
  vendor_code: string;
  package: string;
  category?: string;
}>): Promise<{ morning: DiagnosticSlotPick[]; afternoon: DiagnosticSlotPick[]; evening: DiagnosticSlotPick[] }> {
  const slotBody: Record<string, string> = {
    address_id: body.address_id.trim(),
    date: body.date.trim(),
    vendor_code: body.vendor_code.trim(),
    package: body.package.trim(),
  };
  const cat = body.category?.trim();
  if (cat) slotBody.category = cat;

  const raw = await patientJson<unknown>("diagnostics/slots", {
    method: "POST",
    body: JSON.stringify(slotBody),
  });
  const empty: { morning: DiagnosticSlotPick[]; afternoon: DiagnosticSlotPick[]; evening: DiagnosticSlotPick[] } = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const data = (raw as Record<string, unknown>).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return empty;
  const d = data as Record<string, unknown>;

  function parseBucket(key: string): DiagnosticSlotPick[] {
    const b = d[key];
    if (!Array.isArray(b)) return [];
    const out: DiagnosticSlotPick[] = [];
    for (const row of b) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const s = row as Record<string, unknown>;
      const slot_id = String(s.slot_id ?? "");
      const vendor_code = String(s.vendor_code ?? body.vendor_code);
      const slot_date = String(s.slot_date ?? body.date);
      const start_time = String(s.start_time ?? "");
      const end_time = String(s.end_time ?? "");
      if (!slot_id || !start_time) continue;
      out.push({ slot_id, vendor_code, slot_date, start_time, end_time });
    }
    return out;
  }

  return {
    morning: parseBucket("morning"),
    afternoon: parseBucket("afternoon"),
    evening: parseBucket("evening"),
  };
}

export type DiagnosticsBookingUser = Readonly<{ user_id: number }>;

export type DiagnosticsBookingBody = Readonly<{
  address_id: string;
  sponsored: boolean;
  alternative_phone: string;
  slot: DiagnosticSlotPick;
  users: readonly DiagnosticsBookingUser[];
}>;

export type DiagnosticsHealthUserRow = Readonly<{ user_id: number; packages: readonly number[] }>;

/** Health checkup finalize body — matches patient_app `buildHealthCheckupBookingBody`. */
export type DiagnosticsHealthBookingBody = Readonly<{
  booking_type: "special";
  sponsored: boolean;
  address_id: string;
  alternative_phone: string;
  users: readonly DiagnosticsHealthUserRow[];
  pathology_slot?: DiagnosticSlotPick;
  radiology_slot?: DiagnosticSlotPick;
}>;

function slotPayloadForHealth(s: DiagnosticSlotPick): Record<string, string> {
  return {
    slot_id: s.slot_id,
    vendor_code: s.vendor_code,
    slot_date: s.slot_date,
    start_time: s.start_time,
    end_time: s.end_time,
  };
}

/** POST `/diagnostics/order/booking` with health-checkup payload (pathology/radiology slots). */
export async function postDiagnosticsHealthBooking(
  overview: boolean,
  body: DiagnosticsHealthBookingBody,
  useAppWallet = false,
): Promise<unknown> {
  const q = new URLSearchParams();
  q.set("overview", overview ? "yes" : "no");
  q.set("useAppWallet", useAppWallet ? "yes" : "no");
  const payload: Record<string, unknown> = {
    booking_type: body.booking_type,
    sponsored: body.sponsored,
    address_id: body.address_id.trim(),
    alternative_phone: body.alternative_phone.trim(),
    users: body.users.map((u) => ({ user_id: u.user_id, packages: [...u.packages] })),
  };
  if (body.pathology_slot) payload.pathology_slot = slotPayloadForHealth(body.pathology_slot);
  if (body.radiology_slot) payload.radiology_slot = slotPayloadForHealth(body.radiology_slot);
  return patientJson<unknown>(`diagnostics/order/booking?${q.toString()}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** One line item from `POST …/diagnostics/order/booking?overview=yes` — aligns with Flutter `BookingItem`. */
export type DiagnosticsOverviewLineItem = Readonly<{
  name: string;
  lineTotal: number;
  qty: number;
  category: string;
  free: boolean;
  savedLine: number;
  vendorName: string | null;
  /** From `pricing.vendor.code` — used for unknown-vendor overview UX (patient_app). */
  vendorCode: string | null;
  vendorLogo: string | null;
  offerPrice: number;
  b2cPrice: number;
  userId: number | null;
  userName: string | null;
  userGender: string | null;
}>;

export type NormalizedBookingOverview = Readonly<{
  items: readonly DiagnosticsOverviewLineItem[];
  totalGross: number;
  collectionCharges: number;
  netAmount: number;
  amountToPay: number;
  /** Discount row — `pricing_details.saved` (Flutter `BookingPricingDetails.saved`). */
  pricingSaved: number;
  walletPaid: number | null;
  walletModuleAvailable: number | null;
  /** `opd_wallet.available` — Flip wallet balance line. */
  walletAvailable: number | null;
  userName: string;
  userPhone: string;
  userEmail: string | null;
  addressLine: string;
  /** `address.tag` when present (Flutter collection address chip). */
  addressTag: string | null;
  vendorName: string | null;
  /** `data.slot` / pathology / radiology slot — formatted like Flutter `BookingSlotInfo`. */
  formattedSlotDate: string | null;
  formattedSlotTimeRange: string | null;
  /** `data.info.id`, else `data.id` — canonical order reference for success UI (not `invoice_id`). */
  infoOrderId: string | null;
  /** Patient/member the booking is for — prefers `info` name fields, else primary user display name. */
  bookedForName: string;
}>;

/** Matches Flutter `_overviewIsUnknownVendor` on `BookingItem.pricing.vendor.code`. */
export function overviewVendorCodeIsUnknown(code: string | null | undefined): boolean {
  const c = (code ?? "").trim().toLowerCase();
  return c.length === 0 || c === "unknown";
}

/** Matches Flutter `_overviewHideItemLinePrices`. */
export function overviewHideItemLinePrices(item: DiagnosticsOverviewLineItem): boolean {
  if (item.free) return false;
  if (overviewVendorCodeIsUnknown(item.vendorCode)) return true;
  if (item.offerPrice <= 0 && item.b2cPrice <= 0) return true;
  return false;
}

/** Matches Flutter `_overviewItemsBillablePricingAbsent`. */
export function overviewItemsBillablePricingAbsent(items: readonly DiagnosticsOverviewLineItem[]): boolean {
  let anyNonFree = false;
  for (const item of items) {
    if (item.free) continue;
    anyNonFree = true;
    if (overviewVendorCodeIsUnknown(item.vendorCode)) continue;
    if (item.offerPrice > 0 || item.b2cPrice > 0) return false;
  }
  return anyNonFree;
}

/**
 * When true, Flutter shows a confirm dialog instead of the payment sheet (`_overviewOmitPaymentSection`).
 * Razorpay/finalize still follows API `razorpay_payload` / `payment_required`.
 */
export function overviewOmitPaymentSection(o: NormalizedBookingOverview): boolean {
  const summaryEmpty =
    o.amountToPay <= 0 && o.totalGross <= 0 && o.collectionCharges <= 0;
  if (summaryEmpty) return true;
  if (o.items.length > 0 && overviewItemsBillablePricingAbsent(o.items)) return true;
  return false;
}

function pickLinePrice(pricing: Record<string, unknown> | null): number {
  if (!pricing) return 0;
  const offer = num(pricing.offer_price);
  if (offer != null) return offer;
  const b2c = num(pricing.b2c_price);
  return b2c ?? 0;
}

function parseBookingOverviewSlot(d: Record<string, unknown>): {
  slot_date: string;
  start_time: string;
  end_time: string;
} | null {
  const pathology = asRecord(d.pathology_slot);
  const radiology = asRecord(d.radiology_slot);
  const slot = asRecord(d.slot);
  const src = pathology ?? radiology ?? slot;
  if (!src) return null;
  const slot_date = str(src.slot_date).trim();
  const start_time = str(src.start_time).trim();
  const end_time = str(src.end_time).trim();
  if (!slot_date && !start_time && !end_time) return null;
  return { slot_date, start_time, end_time };
}

/** Match Flutter `BookingSlotInfo` display helpers on the overview response. */
function formatOverviewSlotLabels(slot: {
  slot_date: string;
  start_time: string;
  end_time: string;
}): { formattedSlotDate: string | null; formattedSlotTimeRange: string | null } {
  const rawDate = slot.slot_date.trim();
  let formattedSlotDate: string | null = null;
  if (rawDate) {
    const d = new Date(rawDate.includes("T") ? rawDate : `${rawDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      formattedSlotDate = d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } else {
      formattedSlotDate = rawDate;
    }
  }
  const st = slot.start_time.trim();
  const et = slot.end_time.trim();
  let formattedSlotTimeRange: string | null = null;
  if (st || et) {
    const to12 = (t: string) => {
      const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim());
      if (!m) return t.trim();
      let h = Number(m[1]);
      const min = m[2];
      const ampm = h >= 12 ? "PM" : "AM";
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      return `${String(h)}:${min} ${ampm}`;
    };
    if (st && et) formattedSlotTimeRange = `${to12(st)} - ${to12(et)}`;
    else formattedSlotTimeRange = to12(st || et);
  }
  return { formattedSlotDate, formattedSlotTimeRange };
}

/** Display labels for a stored slot payload — mirrors Flutter `AhcSlot` / `BookingSlotInfo` formatting. */
export function formatDiagnosticSlotPickLabels(p: DiagnosticSlotPick): {
  formattedSlotDate: string | null;
  formattedSlotTimeRange: string | null;
} {
  return formatOverviewSlotLabels({
    slot_date: p.slot_date,
    start_time: p.start_time,
    end_time: p.end_time,
  });
}

export function normalizeBookingOverviewPayload(raw: unknown): NormalizedBookingOverview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const data = root.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;

  const itemsRaw = d.items;
  const items: DiagnosticsOverviewLineItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const pricing =
        o.pricing && typeof o.pricing === "object" && !Array.isArray(o.pricing)
          ? (o.pricing as Record<string, unknown>)
          : null;
      const qtyRaw = num(o.qty);
      const qty = qtyRaw != null && qtyRaw > 0 ? Math.round(qtyRaw) : 1;
      const unit = pickLinePrice(pricing);
      const lineDirect = num(o.line_total) ?? num(o.total);
      const lineTotal = lineDirect != null ? lineDirect : unit * qty;
      const savedLine = pricing != null ? num(pricing.saved) ?? 0 : 0;
      const vendorRec =
        pricing?.vendor && typeof pricing.vendor === "object" && !Array.isArray(pricing.vendor)
          ? (pricing.vendor as Record<string, unknown>)
          : null;
      let lineVendorName =
        vendorRec != null ? str(vendorRec.name).trim() || null : null;
      if (!lineVendorName) {
        lineVendorName =
          str(o.vendor_name).trim() || str(o.vendorName).trim() || null;
      }
      const vendorLogoRaw =
        vendorRec != null && typeof vendorRec.logo === "string" ? vendorRec.logo.trim() : "";
      const userRec =
        o.user && typeof o.user === "object" && !Array.isArray(o.user)
          ? (o.user as Record<string, unknown>)
          : null;
      const uidRaw = userRec != null ? num(userRec.id) : null;
      const userId =
        uidRaw != null && !Number.isNaN(uidRaw) ? Math.round(uidRaw) : null;
      const userName =
        userRec != null
          ? str(userRec.display_name).trim() ||
            str(userRec.displayName).trim() ||
            str(userRec.name).trim() ||
            null
          : null;
      const userGender =
        userRec != null ? str(userRec.gender).trim() || null : null;
      const name = str(o.name).trim() || "Test";
      const offerPx = pricing != null ? num(pricing.offer_price) : null;
      const b2cPx = pricing != null ? num(pricing.b2c_price) : null;
      const vendorCode =
        vendorRec != null ? str(vendorRec.code).trim() || null : null;

      items.push({
        name,
        lineTotal,
        qty,
        category: str(o.category).trim(),
        free: Boolean(o.free),
        savedLine: Number.isNaN(savedLine) ? 0 : savedLine,
        vendorName: lineVendorName,
        vendorCode,
        vendorLogo: vendorLogoRaw ? vendorLogoRaw : null,
        offerPrice: offerPx != null && !Number.isNaN(offerPx) ? offerPx : 0,
        b2cPrice: b2cPx != null && !Number.isNaN(b2cPx) ? b2cPx : 0,
        userId,
        userName,
        userGender,
      });
    }
  }

  const pd = d.pricing_details;
  const pricingDetails =
    pd && typeof pd === "object" && !Array.isArray(pd) ? (pd as Record<string, unknown>) : null;

  const totalGross = pricingDetails ? num(pricingDetails.totalGross) ?? 0 : 0;
  const collectionCharges = pricingDetails ? num(pricingDetails.collection_charges) ?? 0 : 0;
  const netAmount = pricingDetails ? num(pricingDetails.netAmount) ?? 0 : 0;
  const amountToPay = pricingDetails ? num(pricingDetails.amount_to_pay) ?? 0 : 0;
  const pricingSavedRaw = pricingDetails
    ? num(pricingDetails.saved) ?? num(pricingDetails.discount) ?? 0
    : 0;
  const pricingSaved = Number.isNaN(pricingSavedRaw) ? 0 : pricingSavedRaw;

  let walletPaid: number | null = null;
  let walletModuleAvailable: number | null = null;
  let walletAvailable: number | null = null;
  const w = pricingDetails?.opd_wallet;
  if (w && typeof w === "object" && !Array.isArray(w)) {
    const wr = w as Record<string, unknown>;
    walletPaid = num(wr.paid_amount);
    walletModuleAvailable = num(wr.module_available);
    walletAvailable = num(wr.available) ?? num(wr.balance);
  }

  const user =
    d.user && typeof d.user === "object" && !Array.isArray(d.user)
      ? (d.user as Record<string, unknown>)
      : null;
  const userName =
    user != null
      ? str(user.user_name).trim() ||
        str(user.display_name).trim() ||
        str(user.displayName).trim() ||
        str(user.name).trim()
      : "";
  const userPhoneRaw = user != null ? user.user_phone ?? user.phone : null;
  const userPhone =
    typeof userPhoneRaw === "number" && Number.isFinite(userPhoneRaw)
      ? String(userPhoneRaw)
      : str(userPhoneRaw);

  const userEmail =
    user != null
      ? str(user.user_email).trim() || str(user.email).trim() || null
      : null;

  const addr =
    d.address && typeof d.address === "object" && !Array.isArray(d.address)
      ? (d.address as Record<string, unknown>)
      : null;
  const addressLine = addr ? str(addr.display_address).trim() : "";
  const addressTag = addr ? str(addr.tag).trim() || null : null;

  let vendorName: string | null = null;
  const first =
    itemsRaw &&
    Array.isArray(itemsRaw) &&
    itemsRaw[0] &&
    typeof itemsRaw[0] === "object" &&
    !Array.isArray(itemsRaw[0])
      ? (itemsRaw[0] as Record<string, unknown>)
      : null;
  const fp = first?.pricing;
  if (fp && typeof fp === "object" && !Array.isArray(fp)) {
    const vend = (fp as Record<string, unknown>).vendor;
    if (vend && typeof vend === "object" && !Array.isArray(vend)) {
      vendorName = str((vend as Record<string, unknown>).name) || null;
    }
  }
  if (!vendorName) {
    vendorName =
      str(d.vendor_name).trim() ||
      str(d.vendorName).trim() ||
      (asRecord(d.vendor) != null ? str(asRecord(d.vendor)!.name).trim() || null : null);
  }
  if (!vendorName && items.length > 0) {
    vendorName = items.find((it) => it.vendorName)?.vendorName ?? null;
  }

  const info =
    d.info != null && typeof d.info === "object" && !Array.isArray(d.info)
      ? (d.info as Record<string, unknown>)
      : null;
  const infoOrderId =
    (info != null ? nonEmptyStr(info.id) : null) ?? nonEmptyStr(d.id);
  const bookedFromInfo =
    info != null
      ? nonEmptyStr(info.patient_name) ??
        nonEmptyStr(info.patientName) ??
        nonEmptyStr(info.member_name) ??
        nonEmptyStr(info.name)
      : null;
  const bookedForName = bookedFromInfo ?? (userName.trim() || "—");

  const slotParsed = parseBookingOverviewSlot(d);
  const slotLabels = slotParsed
    ? formatOverviewSlotLabels(slotParsed)
    : { formattedSlotDate: null as string | null, formattedSlotTimeRange: null as string | null };

  return {
    items,
    totalGross,
    collectionCharges,
    netAmount,
    amountToPay,
    pricingSaved,
    walletPaid,
    walletModuleAvailable,
    walletAvailable:
      walletAvailable === null || Number.isNaN(walletAvailable) ? null : walletAvailable,
    userName,
    userPhone,
    userEmail,
    addressLine,
    addressTag,
    vendorName,
    formattedSlotDate: slotLabels.formattedSlotDate,
    formattedSlotTimeRange: slotLabels.formattedSlotTimeRange,
    infoOrderId,
    bookedForName,
  };
}

/** POST `/diagnostics/order/booking` — `overview=yes` for summary, `no` to place order. */
export async function postDiagnosticsBooking(
  overview: boolean,
  body: DiagnosticsBookingBody,
  useAppWallet = false,
): Promise<unknown> {
  const q = new URLSearchParams();
  q.set("overview", overview ? "yes" : "no");
  q.set("useAppWallet", useAppWallet ? "yes" : "no");
  return patientJson<unknown>(`diagnostics/order/booking?${q.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      address_id: body.address_id,
      sponsored: body.sponsored,
      alternative_phone: body.alternative_phone,
      slot: {
        slot_id: body.slot.slot_id,
        vendor_code: body.slot.vendor_code,
        slot_date: body.slot.slot_date,
        start_time: body.slot.start_time,
        end_time: body.slot.end_time,
      },
      users: body.users.map((u) => ({ user_id: u.user_id })),
    }),
  });
}

export function parseBookingInvoiceId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = (raw as Record<string, unknown>).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).invoice_id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

/** `POST …/diagnostics/order/booking?overview=no` — aligns with patient_app `DiagnosticsBookingApiResult`. */
export function parseDiagnosticsFinalizeResponse(raw: unknown): Readonly<{
  invoiceId: string | null;
  paymentRequired: boolean;
  razorpayPayload: Record<string, unknown> | null;
}> {
  const invoiceId = parseBookingInvoiceId(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { invoiceId, paymentRequired: false, razorpayPayload: null };
  }
  const root = raw as Record<string, unknown>;
  const paymentRequired =
    root.paymentRequired === true ||
    root.isPaymentRequired === true ||
    root.payment_required === true;
  const rzpRaw = root.razorpay_payload ?? root.razorpayPayload;
  let razorpayPayload: Record<string, unknown> | null = null;
  if (rzpRaw && typeof rzpRaw === "object" && !Array.isArray(rzpRaw)) {
    razorpayPayload = rzpRaw as Record<string, unknown>;
  }
  return { invoiceId, paymentRequired, razorpayPayload };
}
