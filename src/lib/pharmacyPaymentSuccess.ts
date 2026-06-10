import { readAppointmentPaymentLayer } from "@/api/appointmentBook";
import type { InvoiceDetailModel } from "@/api/patientInvoices";
import type {
  BookingSuccessLocationState,
  BookingSuccessSummaryRow,
} from "@/constants/bookingSuccessNavigation";
import { orderReferenceDisplayFromDetail } from "@/lib/bookingSuccessFromInvoice";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function paymentLayer(v: unknown): Record<string, unknown> {
  return v != null ? readAppointmentPaymentLayer(v) : {};
}

/** Razorpay: `pending_amount` on quote; wallet-only: `price` / totals — mirrors patient_app `pharmacy_payment_summary.dart`. */
function pickPaidAmount(merged: Record<string, unknown>, fallbackPayable?: number): number | null {
  const pending = num(merged.pending_amount) ?? num(merged.pendingAmount);
  if (pending != null && pending > 0) return pending;
  const price = num(merged.price);
  if (price != null && price > 0) return price;
  const net = num(merged.net_amount) ?? num(merged.netAmount);
  if (net != null && net > 0) return net;
  const amount = num(merged.amount);
  if (amount != null && amount > 0) return amount;
  const paid = num(merged.paid_amount) ?? num(merged.paidAmount);
  if (paid != null && paid > 0) return paid;
  if (fallbackPayable != null && fallbackPayable > 0) return fallbackPayable;
  return null;
}

function formatRupee(x: number | null): string {
  if (x == null) return "—";
  if (x % 1 === 0) {
    return `₹${x.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  return `₹${x.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isChronicMedicineOrder(detail: InvoiceDetailModel, invoiceRaw?: unknown): boolean {
  const label = detail.serviceTypeLabel?.toLowerCase() ?? "";
  if (label.includes("chronic")) return true;
  if (invoiceRaw != null) {
    const layer = readAppointmentPaymentLayer(invoiceRaw);
    const tt = String(layer.transaction_type ?? layer.transactionType ?? "").toUpperCase();
    if (tt === "CHRONIC_MED" || tt.includes("CHRONIC")) return true;
  }
  return false;
}

export type BuildPharmacyPaymentSuccessOptions = Readonly<{
  routeInvoiceId?: string;
  paymentQuote?: unknown;
  confirmResponse?: unknown;
  paymentId?: string;
  invoiceRaw?: unknown;
  /** Payment sheet `totalPayable` when quote JSON is cleared before navigate. */
  fallbackPayable?: number;
}>;

/**
 * After pharmacy / chronic medicine payment (wallet or Razorpay) — patient_app
 * `PharmacyPaymentSuccessScreen` / `buildPharmacyPaymentSuccessSummary`.
 */
export function buildPharmacyPaymentSuccessFromInvoice(
  detail: InvoiceDetailModel,
  options?: BuildPharmacyPaymentSuccessOptions,
): BookingSuccessLocationState {
  const inv = (options?.routeInvoiceId?.trim() || detail.id.trim());
  const chronic = isChronicMedicineOrder(detail, options?.invoiceRaw);
  const orderKind = chronic ? "Chronic medicine" : "Pharmacy";

  const merged: Record<string, unknown> = {
    ...paymentLayer(options?.paymentQuote),
    ...paymentLayer(options?.confirmResponse),
  };

  const paid = pickPaidAmount(merged, options?.fallbackPayable);
  const visitLabel = detail.serviceVisitTypeLabel?.trim() || "—";
  const orderIdDisplay = orderReferenceDisplayFromDetail(detail);
  const paymentId = options?.paymentId?.trim() ?? "";

  const rows: BookingSuccessSummaryRow[] = [
    ...(orderIdDisplay !== "—" ? [{ label: "Order ID", value: orderIdDisplay }] : []),
    { label: "Amount paid", value: formatRupee(paid) },
    { label: "Fulfillment", value: visitLabel },
    ...(paymentId ? [{ label: "Payment ref", value: paymentId }] : []),
  ];

  const description = chronic
    ? "Your payment is confirmed. We will process your chronic medicine order and keep you updated on dispatch."
    : "Your payment is confirmed. Our pharmacy partner will process your order and contact you if needed.";

  return {
    layout: "summary",
    title: "Payment successful",
    description,
    summaryCardTitle: orderKind,
    summaryRows: rows,
    orderDetailCategoryKey: "pharmacy",
    orderDetailInvoiceId: inv || undefined,
    viewOrderDetailPath: inv ? pathToOrderDetail("pharmacy", inv) : undefined,
  };
}
