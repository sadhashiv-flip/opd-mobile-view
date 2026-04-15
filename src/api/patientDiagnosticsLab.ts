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

export type DiagnosticSlotPick = Readonly<{
  slot_id: string;
  vendor_code: string;
  slot_date: string;
  start_time: string;
  end_time: string;
}>;

/** POST `/diagnostics/slots` — `package` is `"test"` for individual lab flow (Postman). */
export async function fetchDiagnosticSlots(body: Readonly<{
  address_id: string;
  date: string;
  vendor_code: string;
  package: string;
}>): Promise<{ morning: DiagnosticSlotPick[]; afternoon: DiagnosticSlotPick[]; evening: DiagnosticSlotPick[] }> {
  const raw = await patientJson<unknown>("diagnostics/slots", {
    method: "POST",
    body: JSON.stringify({
      address_id: body.address_id.trim(),
      date: body.date.trim(),
      vendor_code: body.vendor_code.trim(),
      package: body.package.trim(),
    }),
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
