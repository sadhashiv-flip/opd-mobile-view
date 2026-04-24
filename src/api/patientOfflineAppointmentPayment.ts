import {
  readAppointmentPaymentLayer,
  readAppointmentResponseMessage,
} from "@/api/appointmentBook";
import type { InvoiceDetailModel } from "@/api/patientInvoices";
import { patientJson } from "@/api/patientHttp";

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Bottom sheet row model built from `PATCH /offline/appointment/payment/:id?useWallet=`. */
export type OfflineBookingPaymentSheetModel = Readonly<{
  totalAmountFormatted: string;
  walletDebitLineFormatted: string;
  limitAvailableFormatted: string | null;
  totalPayable: number;
  totalPayableFormatted: string;
  showWalletSection: boolean;
  /** When false, hide “Using from OPD wallet” (e.g. only balance/limit from preview). */
  showWalletDebitRow: boolean;
  walletHeading: string;
}>;

/**
 * Maps preview PATCH JSON (e.g. `price`, `pending_amount`, `opdWallet`) to booking confirmation UI.
 * Also supports gym-style flat fields (`opt_in_amount`, `opd_paid_amount`, `opd_wallet_available`) from `PATCH gym/payment/...`.
 */
/**
 * Gym order pay sheet: totals from {@link InvoiceDetailModel} (`GET /invoice/:id`) — avoids an extra `PATCH gym/payment/:id?useWallet=` preview call.
 * Payment continues with {@link patchGymPaymentConfirm} (`status=confirm`) then Razorpay / verify.
 */
export function mapGymInvoiceDetailToBookingSheetModel(detail: InvoiceDetailModel): OfflineBookingPaymentSheetModel {
  const pending = Math.max(0, Math.floor(Number(detail.netPayAmount)) || 0);
  const walletAmt = Math.max(0, Math.floor(detail.walletDebitAmount ?? 0));
  const price = walletAmt > 0 ? pending + walletAmt : pending;
  const debitAmount = walletAmt;
  const showWalletDebitRow = debitAmount > 0;

  return {
    totalAmountFormatted: formatInr(price),
    walletDebitLineFormatted: `- ${formatInr(debitAmount)}`,
    limitAvailableFormatted: null,
    totalPayable: pending,
    totalPayableFormatted: formatInr(pending),
    showWalletSection: showWalletDebitRow,
    showWalletDebitRow,
    walletHeading: "OPD Wallet",
  };
}

export function mapOfflinePaymentPreviewToSheetModel(body: unknown): OfflineBookingPaymentSheetModel {
  const layer = readAppointmentPaymentLayer(body);
  const priceRaw =
    num(layer.price) ??
    num(layer.opt_in_amount) ??
    num(layer.optInAmount) ??
    num(layer.total_amount) ??
    num(layer.totalAmount) ??
    0;
  const price = Math.max(0, Math.floor(priceRaw));
  const pending = Math.max(0, Math.floor(num(layer.pending_amount) ?? num(layer.pendingAmount) ?? 0));
  const opd = asRecord(layer.opdWallet) ?? asRecord(layer.opd_wallet);
  const usedOpdRaw =
    opd != null
      ? num(opd.used_amount) ?? num(opd.usedAmount) ?? num(opd.used) ?? null
      : null;
  const usedOpd = usedOpdRaw != null && Number.isFinite(usedOpdRaw) ? Math.max(0, Math.floor(usedOpdRaw)) : 0;
  const usedFromFlat = Math.max(
    0,
    Math.floor(num(layer.opd_paid_amount) ?? num(layer.opdPaidAmount) ?? 0),
  );
  const avail =
    opd != null
      ? (num(opd.available) ??
          num(opd.module_available) ??
          num(opd.moduleAvailable) ??
          num(opd.total) ??
          null)
      : null;
  let limitInt = avail != null && Number.isFinite(avail) ? Math.max(0, Math.floor(avail)) : null;
  if (limitInt == null) {
    const flatAvail = num(layer.opd_wallet_available) ?? num(layer.opdWalletAvailable);
    if (flatAvail != null && Number.isFinite(flatAvail)) {
      limitInt = Math.max(0, Math.floor(flatAvail));
    }
  }

  const debitFromMath = price > 0 || pending >= 0 ? Math.max(0, price - pending) : 0;
  const debitAmount =
    usedOpd > 0 ? usedOpd : usedFromFlat > 0 ? usedFromFlat : debitFromMath;

  const showWalletDebitRow = debitAmount > 0;
  const showWallet =
    opd != null ||
    usedFromFlat > 0 ||
    usedOpd > 0 ||
    debitFromMath > 0 ||
    (limitInt != null && limitInt > 0);

  return {
    totalAmountFormatted: formatInr(price),
    walletDebitLineFormatted: `- ${formatInr(debitAmount)}`,
    limitAvailableFormatted: limitInt != null ? formatInr(limitInt) : null,
    totalPayable: pending,
    totalPayableFormatted: formatInr(pending),
    showWalletSection: showWallet,
    showWalletDebitRow,
    walletHeading: "OPD Wallet",
  };
}

function offlinePaymentPath(invoiceId: string, query: Record<string, string | boolean>): string {
  const id = encodeURIComponent(invoiceId.trim());
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    q.set(k, typeof v === "boolean" ? (v ? "true" : "false") : v);
  }
  return `offline/appointment/payment/${id}?${q.toString()}`;
}

/** Preview totals / wallet — `PATCH /offline/appointment/payment/:invoice_id?useWallet=`. */
export async function patchOfflineAppointmentPaymentPreview(
  invoiceId: string,
  useWallet: boolean,
): Promise<unknown> {
  const path = offlinePaymentPath(invoiceId, { useWallet });
  return patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
}

export type OfflinePaymentConfirmResult = Readonly<{
  paymentRequired: boolean;
  razorpayPayload: Record<string, unknown> | null;
  message?: string;
}>;

function readRazorpayPayloadFromOfflineConfirm(raw: unknown): Record<string, unknown> | null {
  const layer = readAppointmentPaymentLayer(raw);
  const rawPayload = layer.razorpay_payload ?? layer.razorpayPayload;
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return null;
  return rawPayload as Record<string, unknown>;
}

function paymentRequiredFromConfirm(raw: unknown): boolean {
  const layer = readAppointmentPaymentLayer(raw);
  const pr = layer.paymentRequired ?? layer.payment_required;
  if (pr === false || pr === "false" || pr === 0) return false;
  const rzp = readRazorpayPayloadFromOfflineConfirm(raw);
  if (rzp != null && Object.keys(rzp).length > 0) return true;
  return pr === true || pr === "true" || pr === 1;
}

/** Confirm step — `PATCH ...?useWallet=&status=confirm`; may return `razorpay_payload`. */
export async function patchOfflineAppointmentPaymentConfirm(
  invoiceId: string,
  useWallet: boolean,
): Promise<OfflinePaymentConfirmResult> {
  const path = offlinePaymentPath(invoiceId, { useWallet, status: "confirm" });
  const raw = await patientJson<unknown>(path, { method: "PATCH", skipGlobalLoading: true });
  return {
    paymentRequired: paymentRequiredFromConfirm(raw),
    razorpayPayload: readRazorpayPayloadFromOfflineConfirm(raw),
    message: readAppointmentResponseMessage(raw),
  };
}
