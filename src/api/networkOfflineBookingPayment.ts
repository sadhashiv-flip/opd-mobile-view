import { readAppointmentPaymentLayer } from "@/api/appointmentBook";
import type { VirtualOnlinePaymentSheetModel } from "@/api/virtualOnlineBookingPayment";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatInr(amount: number): string {
  const n = Math.max(0, amount);
  if (n % 1 === 0) return `₹ ${n.toLocaleString("en-IN")}`;
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** patient_app `NetworkBookResponse.payableAmount`. */
function payableAmount(layer: Record<string, unknown>): number {
  const pending = num(layer.pending_amount);
  if (pending > 0) return pending;
  const paymentRequired =
    layer.paymentRequired === true ||
    layer.payment_required === true ||
    layer.isPaymentRequired === true;
  if (paymentRequired) {
    const price = num(layer.price);
    if (price > 0) return price;
    const fee = num(layer.consultation_fee);
    if (fee > 0) return fee;
  }
  return 0;
}

/** Map `POST /appointment/network_book` preview to payment sheet (Dart `OfflineBookingPaymentSheet`). */
export function mapNetworkBookPreviewToPaymentSheet(
  data: unknown,
): VirtualOnlinePaymentSheetModel | null {
  if (data == null || typeof data !== "object") return null;
  const layer = readAppointmentPaymentLayer(data) as Record<string, unknown>;
  const message =
    typeof layer.message === "string" && layer.message.trim()
      ? layer.message.trim()
      : "Booking confirmation";
  const consultationFee =
    num(layer.consultation_fee) > 0 ? num(layer.consultation_fee) : num(layer.price);
  const walletUsed = num(layer.opd_wallet_used);
  const paidAmount = num(layer.paid_amount);
  const payable = payableAmount(layer);
  const paymentRequired =
    layer.paymentRequired === true ||
    layer.payment_required === true ||
    layer.isPaymentRequired === true;

  const note = paymentRequired
    ? "Note: Your available OPD wallet balance is not enough to cover the full fee. Please proceed to pay the remaining amount."
    : "Note: No additional payment is required. Proceed to confirm your appointment.";

  return {
    title: message,
    consultationFeeFormatted: formatInr(consultationFee),
    walletDebitFormatted: walletUsed > 0 ? `- ${formatInr(walletUsed)}` : null,
    paidAmountFormatted:
      paidAmount > 0 && paidAmount !== walletUsed ? formatInr(paidAmount) : null,
    totalPayable: payable,
    totalPayableFormatted: formatInr(payable),
    paymentRequired,
    note,
  };
}
