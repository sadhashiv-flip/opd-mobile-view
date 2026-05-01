import type { DashboardOngoingItem } from "@/api/patientDashboard";
import type { InvoiceOrderListStatusTone, InvoiceOrderRow } from "@/api/patientInvoices";

/** Passed from {@link ROUTES.dashboard} “View all” → {@link ROUTES.orders}. */
export type OrdersPageLocationState = Readonly<{
  dashboardOngoing?: readonly DashboardOngoingItem[];
}>;

function statusToneFromDashboardOngoing(item: DashboardOngoingItem): InvoiceOrderListStatusTone {
  const s = item.statusLabel.toLowerCase();
  if (s.includes("completed")) return "completed";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("expired")) return "expired";
  if (s.includes("payment pending")) return "paymentPending";
  if (s.includes("confirm")) return "confirmPending";
  if (s.includes("upcoming") || s.includes("session")) return "upcoming";
  if (s.includes("processing") || s.includes("pending")) return "processing";
  return "other";
}

/** Maps dashboard ongoing tiles to the same list row shape as {@link fetchInvoicesPage} (no extra GET /invoice). */
export function invoiceOrderRowsFromDashboardOngoing(
  items: readonly DashboardOngoingItem[],
): InvoiceOrderRow[] {
  const out: InvoiceOrderRow[] = [];
  for (const item of items) {
    const categoryKey =
      item.orderCategoryIconKey === "orders_all" ? "other" : item.orderCategoryIconKey;
    const isConsultation =
      categoryKey === "consultation" || item.orderType.trim().toUpperCase() === "APPOINTMENT";
    const who = item.patientLine.replace(/^For\s+/i, "").trim();
    let metaLine = "—";
    if (who.length > 0) metaLine = `${who} • ${item.whenLine}`;
    else if (item.whenLine.length > 0) metaLine = item.whenLine;

    let consultationPlaceTag: InvoiceOrderRow["consultationPlaceTag"] = null;
    if (isConsultation) {
      consultationPlaceTag = item.canJoinVideoCall ? "virtual" : "inPerson";
    }

    out.push({
      id: item.invoiceId,
      infoId: null,
      categoryLabel: item.displayCategory,
      categoryKey,
      orderIdLine: "",
      metaLine,
      statusTone: statusToneFromDashboardOngoing(item),
      statusLabel: item.statusLabel,
      isFree: false,
      amountFormatted: null,
      canJoinOnlineConsultation: false,
      videoAppointmentId: null,
      consultationPlaceTag,
    });
  }
  return out;
}
