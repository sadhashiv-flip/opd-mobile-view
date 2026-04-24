import { readAppointmentPaymentLayer } from "@/api/appointmentBook";
import { readPatientApiError } from "@/api/patientClient";
import { patientFetch, patientJson } from "@/api/patientHttp";
import {
  normalizeRazorpayCheckoutPayload,
  readRazorpayPayloadFromPaymentEnvelope,
} from "@/lib/razorpayCheckout";

/** GET gym/check — `data` payload after a typical API envelope. */

export type GymCheckPackage = Readonly<{
  tnc: string;
  mrp_amount: number;
  pay_amount: number;
  package_code: string;
  package_name: string;
  enable_wallet: boolean;
  package_amount: number;
  validity_units: string;
  validity_value: number;
}>;

export type GymCheckOrderInfo = Readonly<{
  name: string;
  phone: string;
  email: string;
  personal_email: string;
}>;

export type GymCheckOrderDetails = Readonly<{
  location: string;
  package_details: GymCheckPackage;
  info: GymCheckOrderInfo;
}>;

export type GymCheckOrder = Readonly<{
  status: number;
  invoice_id: string;
  details: GymCheckOrderDetails;
}>;

export type GymCheckData = Readonly<{
  membership: string;
  gym_module: boolean;
  dependents: readonly string[];
  subscription_id: string;
  packages: readonly GymCheckPackage[];
  order: GymCheckOrder | null;
  payment_available: boolean;
}>;

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function bool(v: unknown): boolean {
  return v === true;
}

function parsePackage(raw: unknown): GymCheckPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const package_code = str(o.package_code);
  if (!package_code) return null;
  return {
    tnc: str(o.tnc),
    mrp_amount: num(o.mrp_amount),
    pay_amount: num(o.pay_amount),
    package_code,
    package_name: str(o.package_name) || package_code,
    enable_wallet: bool(o.enable_wallet),
    package_amount: num(o.package_amount),
    validity_units: str(o.validity_units, "months"),
    validity_value: num(o.validity_value),
  };
}

function parseOrderInfo(raw: unknown): GymCheckOrderInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    name: str(o.name),
    phone: str(o.phone),
    email: str(o.email),
    personal_email: str(o.personal_email),
  };
}

function parseOrder(raw: unknown): GymCheckOrder | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const invoice_id = str(o.invoice_id);
  if (!invoice_id && o.status == null) return null;
  const det = o.details;
  if (!det || typeof det !== "object") return null;
  const d = det as Record<string, unknown>;
  const pkg = parsePackage(d.package_details);
  const info = parseOrderInfo(d.info);
  if (!pkg || !info) return null;
  return {
    status: num(o.status),
    invoice_id: invoice_id || "—",
    details: {
      location: str(d.location),
      package_details: pkg,
      info,
    },
  };
}

export function parseGymCheckPayload(raw: unknown): GymCheckData | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const data = root.data;
  const d =
    data !== undefined && typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : root;
  const looksLikePayload =
    typeof d.gym_module === "boolean" ||
    Array.isArray(d.packages) ||
    typeof d.membership === "string";
  if (!looksLikePayload) {
    return null;
  }
  const pkgsRaw = d.packages;
  const packages: GymCheckPackage[] = [];
  if (Array.isArray(pkgsRaw)) {
    for (const p of pkgsRaw) {
      const parsed = parsePackage(p);
      if (parsed) packages.push(parsed);
    }
  }
  const depsRaw = d.dependents;
  const dependents: string[] = Array.isArray(depsRaw)
    ? depsRaw.filter((x): x is string => typeof x === "string")
    : [];

  const order = parseOrder(d.order);

  return {
    membership: str(d.membership),
    gym_module: bool(d.gym_module),
    dependents,
    subscription_id: str(d.subscription_id),
    packages,
    order,
    payment_available: bool(d.payment_available),
  };
}

export async function getGymCheck(): Promise<GymCheckData> {
  const raw = await patientJson<unknown>("gym/check", { method: "GET" });
  const parsed = parseGymCheckPayload(raw);
  if (!parsed) {
    throw new Error("Invalid gym check response");
  }
  return parsed;
}

/**
 * Relative path under the patient API base (`VITE_API_BASE_URL`, typically ending with `/patient`).
 * Default `gym/optIn` → **`POST …/patient/gym/optIn`**.
 */
function gymOptInPath(): string {
  const p = import.meta.env.VITE_GYM_OPTIN_PATH?.trim();
  return p && p.length > 0 ? p.replace(/^\//, "") : "gym/optIn";
}

/** POST `gym/optIn` — enrolment payload before payment (server: `GymController.gymOptIn`). */
export type GymOptInRequest = Readonly<{
  location: string;
  package_code: string;
  subscription_id?: string | null;
  name: string;
  phone: string;
  email: string;
  personal_email: string;
}>;

function numOptIn(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v.trim());
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function strOptIn(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export type GymOptInResult = Readonly<{
  opd_paid_amount: number | null;
  opd_wallet_available: number | null;
  opt_in_amount: number | null;
  pending_amount: number | null;
  payment_required: boolean;
  invoice_id: string | null;
  order_id: string | null;
  /** Checkout options when the server returns them; `amount` may be set from `pending_amount` (rupees → paise). */
  razorpay_payload: Record<string, unknown> | null;
  message: string | null;
}>;

function inferPaymentRequired(
  layer: Record<string, unknown>,
  pending_amount: number | null,
): boolean {
  const pr = layer.payment_required ?? layer.paymentRequired;
  if (pr === false || pr === "false" || pr === 0) return false;
  if (pr === true || pr === "true" || pr === 1) return true;
  return pending_amount != null && pending_amount > 0;
}

/** Phase A (quote): no persisted invoice/order/checkout. Phase B (confirm): full payment shape. */
export type GymOptInPhase = "quote" | "confirm";

function parseGymOptInResponse(raw: unknown, phase: GymOptInPhase): GymOptInResult {
  const layer = readAppointmentPaymentLayer(raw);
  const pending_amount = numOptIn(layer.pending_amount ?? layer.pendingAmount);
  const payment_required = inferPaymentRequired(layer, pending_amount);
  const opt_in_amount = numOptIn(layer.opt_in_amount ?? layer.optInAmount);
  const opd_paid_amount = numOptIn(layer.opd_paid_amount ?? layer.opdPaidAmount);
  const opd_wallet_available = numOptIn(layer.opd_wallet_available ?? layer.opdWalletAvailable);

  let razorpay_payload =
    phase === "confirm" && payment_required
      ? readRazorpayPayloadFromPaymentEnvelope(layer)
      : null;

  if (
    phase === "confirm" &&
    payment_required &&
    razorpay_payload != null &&
    Object.keys(razorpay_payload).length > 0
  ) {
    const next = { ...razorpay_payload };
    if (pending_amount != null && pending_amount > 0) {
      const amountPaise = Math.max(100, Math.round(pending_amount * 100));
      if (next.amount == null || next.amount === "") {
        next.amount = amountPaise;
      }
    }
    razorpay_payload = normalizeRazorpayCheckoutPayload(next);
  }

  const msgRaw = layer.message;
  const message =
    typeof msgRaw === "string" && msgRaw.trim() ? msgRaw.trim() : null;

  let invoice_id = strOptIn(layer.invoice_id ?? layer.invoiceId);
  let order_id = strOptIn(layer.order_id ?? layer.orderId);

  if (phase === "quote") {
    invoice_id = null;
    order_id = null;
    razorpay_payload = null;
  }

  return {
    opd_paid_amount,
    opd_wallet_available,
    opt_in_amount,
    pending_amount,
    payment_required,
    invoice_id,
    order_id,
    razorpay_payload,
    message,
  };
}

async function postGymOptInRequest(body: GymOptInRequest, phase: GymOptInPhase): Promise<GymOptInResult> {
  const base = gymOptInPath();
  const path = phase === "confirm" ? `${base}?status=confirm` : base;
  const res = await patientFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  if (!text) {
    return parseGymOptInResponse({}, phase);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid JSON from gym opt-in");
  }
  return parseGymOptInResponse(raw, phase);
}

/**
 * **Phase A – Quote (no persistence).**
 * `POST /patient/gym/optIn` — **without** `?status=confirm`.
 *
 * Expect `data`: `opd_paid_amount`, `opd_wallet_available`, `opt_in_amount`, `pending_amount`, `payment_required`.
 * Returned model omits `invoice_id`, `order_id`, and `razorpay_payload` so the client never treats a quote as a checkout.
 */
export async function postGymOptInQuote(body: GymOptInRequest): Promise<GymOptInResult> {
  return postGymOptInRequest(body, "quote");
}

/**
 * **Phase B – Confirm (creates records).**
 * `POST /patient/gym/optIn?status=confirm` — same body as Phase A.
 *
 * Parse `payment_required`, `invoice_id`, `razorpay_payload` (when gateway pay is required), `message`.
 */
export async function postGymOptInConfirm(body: GymOptInRequest): Promise<GymOptInResult> {
  return postGymOptInRequest(body, "confirm");
}

/**
 * Gym opt-in: quote (`confirm` false / omitted) or confirm (`confirm: true`).
 * Prefer {@link postGymOptInQuote} / {@link postGymOptInConfirm}.
 */
export async function postGymOptIn(
  body: GymOptInRequest,
  opts?: Readonly<{ confirm?: boolean }>,
): Promise<GymOptInResult> {
  return postGymOptInRequest(body, opts?.confirm === true ? "confirm" : "quote");
}
