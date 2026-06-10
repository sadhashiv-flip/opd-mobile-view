import type { BookingSuccessLocationState } from "@/constants/bookingSuccessNavigation";
import type { NormalizedBookingOverview } from "@/api/patientDiagnosticsLab";
import { formatDiagnosticsSuccessScheduleDisplay } from "@/api/patientDiagnosticsLab";
import { pathToOrderDetail, resolveLabOrderDetailRouteId } from "@/lib/orderDetailRoutes";

const DEFAULT_SUB =
  "your request is successfully submitted,\nour executive will contact you shortly.";

/**
 * Shared success screen state for health checkups and lab tests after payment or $0 / no gateway.
 * Reuse the same shape for other services by building `summaryRows` + `orderDetail*` in the caller.
 */
export function buildDiagnosticsBookingSuccessState(args: {
  readonly invoiceId: string;
  readonly overview: NormalizedBookingOverview | null;
  readonly scheduleDisplay: string;
  /** e.g. "Home" — first line for location. */
  readonly locationTag?: string;
  readonly addressLine: string;
}): BookingSuccessLocationState {
  const invoiceDocId = args.invoiceId.trim();
  const infoId = args.overview?.infoOrderId?.trim() ?? "";
  const routeId = resolveLabOrderDetailRouteId({
    documentInvoiceId: invoiceDocId,
    infoOrderId: infoId,
  });
  /** Dart `DiagnosticsBookingSuccessScreen` — `#${overview.invoiceId}` when present. */
  const orderDisplay = routeId ? `#${routeId.replace(/^#/, "")}` : "—";
  const serviceNames =
    args.overview != null && args.overview.items.length > 0
      ? args.overview.items
        .map((i) => i.name)
        .filter((n) => n.trim().length > 0)
        .join(" / ")
      : "—";
  const bookedFor = args.overview?.bookedForName?.trim() || "—";
  const tag = (args.locationTag ?? "Home").trim() || "Home";
  const addr = args.addressLine.trim();
  const locationValue = addr ? `${tag}\n${addr}` : tag;
  const scheduleFromOverview =
    args.overview?.bookingSlots.length
      ? formatDiagnosticsSuccessScheduleDisplay(args.overview.bookingSlots)
      : "";
  const scheduleDisplay = args.scheduleDisplay.trim() || scheduleFromOverview || "—";

  return {
    layout: "summary",
    title: "Booking successful",
    description: DEFAULT_SUB,
    summaryCardTitle: "Appointment summary",
    summaryRows: [
      { label: "Order ID", value: orderDisplay },
      { label: "Booked for", value: bookedFor },
      { label: "Service", value: serviceNames },
      { label: "Location", value: locationValue },
      { label: "Schedule", value: scheduleDisplay },
    ],
    orderDetailCategoryKey: "lab",
    /** Document invoice id for `/order/lab/:id` — patient_app `overview.invoiceId`. */
    orderDetailInvoiceId: routeId || undefined,
    viewOrderDetailPath: routeId ? pathToOrderDetail("lab", routeId) : undefined,
  };
}
