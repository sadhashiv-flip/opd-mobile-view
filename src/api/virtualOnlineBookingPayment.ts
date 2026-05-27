import {
  isAppointmentPaymentRequired,
  readAppointmentPaymentLayer,
} from "@/api/appointmentBook";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function formatInr(amount: number): string {
  const n = Math.max(0, amount);
  if (n % 1 === 0) return `₹ ${n.toLocaleString("en-IN")}`;
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Shared payment sheet model — virtual `book` and at-hospital `network_book` previews. */
export type VirtualOnlinePaymentSheetModel = Readonly<{
  title: string;
  consultationFeeFormatted: string;
  walletDebitFormatted: string | null;
  /** Shown when API returns paid_amount distinct from wallet (offline flow). */
  paidAmountFormatted: string | null;
  totalPayable: number;
  totalPayableFormatted: string;
  paymentRequired: boolean;
  note: string;
}>;

export function mapOnlineBookPreviewToPaymentSheet(
  data: unknown,
): VirtualOnlinePaymentSheetModel | null {
  if (data == null || typeof data !== "object") return null;
  const layer = readAppointmentPaymentLayer(data);
  const price = Math.max(0, Math.floor(num(layer.price)));
  const wallet = asRecord(layer.wallet) ?? {};
  const usedWallet = Math.max(0, Math.floor(num(wallet.used_amount) ?? num(wallet.usedAmount)));
  const pending = Math.max(0, Math.floor(num(wallet.pending_amount) ?? num(wallet.pendingAmount)));
  const paymentRequired = isAppointmentPaymentRequired(data);
  const payable = pending > 0 ? pending : paymentRequired ? price : 0;

  const note = paymentRequired
    ? "Note: Your available balance for consultation has exhausted. Please proceed to pay to use our services."
    : "Note: No payment is required for this consultation. Proceed to confirm your booking.";

  return {
    title: "Booking confirmation",
    consultationFeeFormatted: formatInr(price),
    walletDebitFormatted: usedWallet > 0 ? `- ${formatInr(usedWallet)}` : null,
    paidAmountFormatted: null,
    totalPayable: payable,
    totalPayableFormatted: formatInr(payable),
    paymentRequired,
    note,
  };
}
