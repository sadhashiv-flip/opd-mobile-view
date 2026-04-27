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

/** Server may send post-deduction balances — avoids subtracting twice if `available` is already net of this order. */
function readOverallWalletAfterDeductionExplicit(opd: Record<string, unknown>): number | null {
  const ex =
    num(opd.remaining_balance) ??
    num(opd.remainingBalance) ??
    num(opd.wallet_remaining) ??
    num(opd.walletRemaining) ??
    num(opd.balance_after) ??
    num(opd.balanceAfter) ??
    num(opd.available_after) ??
    num(opd.availableAfter);
  if (ex != null && Number.isFinite(ex)) return Math.max(0, Math.floor(ex));
  return null;
}

function readModuleLimitAfterDeductionExplicit(opd: Record<string, unknown>): number | null {
  const ex =
    num(opd.module_remaining) ??
    num(opd.moduleRemaining) ??
    num(opd.remaining_module_available) ??
    num(opd.remaining_module_limit) ??
    num(opd.remainingModuleAvailable);
  if (ex != null && Number.isFinite(ex)) return Math.max(0, Math.floor(ex));
  return null;
}

/** Bottom sheet row model built from `PATCH /offline/appointment/payment/:id?useWallet=`. */
export type OfflineBookingPaymentSheetModel = Readonly<{
  totalAmountFormatted: string;
  walletDebitLineFormatted: string;
  /** INR — from `opd_wallet.module_available` (this module), not overall `available`. */
  limitAvailableFormatted: string | null;
  /** Overall OPD wallet left after this booking’s wallet debit — API fields first, else `available − debit`. */
  walletRemainingAfterDeductionFormatted: string | null;
  /** Module budget left after this debit — API fields first, else `module_available − debit`. */
  moduleLimitRemainingAfterDeductionFormatted: string | null;
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
    walletRemainingAfterDeductionFormatted: null,
    moduleLimitRemainingAfterDeductionFormatted: null,
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
  /** Per-module ceiling for this booking — prefer `module_available`, not overall wallet `available`. */
  const moduleAvailNested =
    opd != null ? (num(opd.module_available) ?? num(opd.moduleAvailable)) : null;
  let limitInt =
    moduleAvailNested != null && Number.isFinite(moduleAvailNested)
      ? Math.max(0, Math.floor(moduleAvailNested))
      : null;
  if (limitInt == null) {
    const flatModule =
      num(layer.module_available) ??
      num(layer.moduleAvailable) ??
      num(layer.opd_module_available) ??
      num(layer.opdModuleAvailable);
    if (flatModule != null && Number.isFinite(flatModule)) {
      limitInt = Math.max(0, Math.floor(flatModule));
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

  let walletRemainingAfterInt: number | null = null;
  let moduleRemainingAfterInt: number | null = null;
  if (opd != null) {
    walletRemainingAfterInt = readOverallWalletAfterDeductionExplicit(opd);
    moduleRemainingAfterInt = readModuleLimitAfterDeductionExplicit(opd);
  }
  if (walletRemainingAfterInt == null) {
    const overallBefore =
      opd != null ? (num(opd.available) ?? num(opd.balance)) : null;
    const flatOverall = num(layer.opd_wallet_available) ?? num(layer.opdWalletAvailable);
    const overallBase =
      overallBefore != null && Number.isFinite(overallBefore)
        ? Math.max(0, Math.floor(overallBefore))
        : flatOverall != null && Number.isFinite(flatOverall)
          ? Math.max(0, Math.floor(flatOverall))
          : null;
    if (overallBase != null) {
      walletRemainingAfterInt = Math.max(0, overallBase - debitAmount);
    }
  }
  if (moduleRemainingAfterInt == null && limitInt != null) {
    moduleRemainingAfterInt = Math.max(0, limitInt - debitAmount);
  }

  return {
    totalAmountFormatted: formatInr(price),
    walletDebitLineFormatted: `- ${formatInr(debitAmount)}`,
    limitAvailableFormatted: limitInt != null ? formatInr(limitInt) : null,
    walletRemainingAfterDeductionFormatted:
      walletRemainingAfterInt != null ? formatInr(walletRemainingAfterInt) : null,
    moduleLimitRemainingAfterDeductionFormatted:
      moduleRemainingAfterInt != null ? formatInr(moduleRemainingAfterInt) : null,
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
