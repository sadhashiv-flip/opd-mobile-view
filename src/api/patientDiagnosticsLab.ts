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

export type NormalizedBookingOverview = Readonly<{
  items: readonly { name: string; lineTotal: number; qty: number }[];
  totalGross: number;
  collectionCharges: number;
  netAmount: number;
  amountToPay: number;
  walletPaid: number | null;
  walletModuleAvailable: number | null;
  userName: string;
  userPhone: string;
  addressLine: string;
  vendorName: string | null;
}>;

function pickLinePrice(pricing: Record<string, unknown> | null): number {
  if (!pricing) return 0;
  const offer = num(pricing.offer_price);
  if (offer != null) return offer;
  const b2c = num(pricing.b2c_price);
  return b2c ?? 0;
}

export function normalizeBookingOverviewPayload(raw: unknown): NormalizedBookingOverview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const data = root.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;

  const itemsRaw = d.items;
  const items: { name: string; lineTotal: number; qty: number }[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const name = str(o.name) || "Test";
      const qty = num(o.qty) ?? 1;
      const pricing =
        o.pricing && typeof o.pricing === "object" && !Array.isArray(o.pricing)
          ? (o.pricing as Record<string, unknown>)
          : null;
      const unit = pickLinePrice(pricing);
      items.push({ name, lineTotal: unit * qty, qty });
    }
  }

  const pd = d.pricing_details;
  const pricingDetails =
    pd && typeof pd === "object" && !Array.isArray(pd) ? (pd as Record<string, unknown>) : null;

  const totalGross = pricingDetails ? num(pricingDetails.totalGross) ?? 0 : 0;
  const collectionCharges = pricingDetails ? num(pricingDetails.collection_charges) ?? 0 : 0;
  const netAmount = pricingDetails ? num(pricingDetails.netAmount) ?? 0 : 0;
  const amountToPay = pricingDetails ? num(pricingDetails.amount_to_pay) ?? 0 : 0;

  let walletPaid: number | null = null;
  let walletModuleAvailable: number | null = null;
  const w = pricingDetails?.opd_wallet;
  if (w && typeof w === "object" && !Array.isArray(w)) {
    const wr = w as Record<string, unknown>;
    walletPaid = num(wr.paid_amount);
    walletModuleAvailable = num(wr.module_available);
  }

  const user = d.user && typeof d.user === "object" && !Array.isArray(d.user) ? (d.user as Record<string, unknown>) : null;
  const userName = user ? str(user.user_name) || str(user.name) : "";
  const userPhoneRaw = user ? user.user_phone ?? user.phone : null;
  const userPhone =
    typeof userPhoneRaw === "number" && Number.isFinite(userPhoneRaw)
      ? String(userPhoneRaw)
      : str(userPhoneRaw);

  const addr = d.address && typeof d.address === "object" && !Array.isArray(d.address) ? (d.address as Record<string, unknown>) : null;
  const addressLine = addr ? str(addr.display_address) : "";

  let vendorName: string | null = null;
  const first = itemsRaw && Array.isArray(itemsRaw) && itemsRaw[0] && typeof itemsRaw[0] === "object" && !Array.isArray(itemsRaw[0])
    ? (itemsRaw[0] as Record<string, unknown>)
    : null;
  const fp = first?.pricing;
  if (fp && typeof fp === "object" && !Array.isArray(fp)) {
    const vend = (fp as Record<string, unknown>).vendor;
    if (vend && typeof vend === "object" && !Array.isArray(vend)) {
      vendorName = str((vend as Record<string, unknown>).name) || null;
    }
  }

  return {
    items,
    totalGross,
    collectionCharges,
    netAmount,
    amountToPay,
    walletPaid,
    walletModuleAvailable,
    userName,
    userPhone,
    addressLine,
    vendorName,
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
