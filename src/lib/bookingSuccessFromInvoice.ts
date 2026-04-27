import type { InvoiceDetailModel } from "@/api/patientInvoices";
import type { BookingSuccessLocationState } from "@/constants/bookingSuccessNavigation";

const DEFAULT_SUB =
  "your request is successfully submitted,\nour executive will contact you shortly.";

/** Order ID row — `info.id` only (never invoice id). Matches {@link InvoiceDetailModel.infoOrderIdFormatted}. */
export function orderReferenceDisplayFromDetail(detail: InvoiceDetailModel): string {
  const raw = detail.consultationInfoId?.trim();
  if (!raw) return "—";
  return (
    detail.infoOrderIdFormatted?.trim() ?? `#${raw.replace(/^#/, "")}`
  );
}

function serviceLineFromItems(detail: InvoiceDetailModel): string {
  const names = detail.lineItems.map((l) => l.productName).filter((n) => n.trim().length > 0);
  if (names.length > 0) {
    if (names.length === 1) return names[0] ?? "—";
    if (names.length <= 2) return names.join(" / ");
    return `${names[0] ?? ""} + ${String(names.length - 1)} more`;
  }
  return detail.serviceTypeLabel?.trim() || "—";
}

function labLocationLine(detail: InvoiceDetailModel): string {
  const loc = detail.pharmacyOrderLocation;
  const tag =
    loc?.headerName?.trim() ||
    loc?.cardTitle?.trim() ||
    "Home";
  const addr = loc?.addressText?.trim() ?? "";
  if (addr.length > 0) return `${tag}\n${addr}`;
  const v = detail.vendorName?.trim();
  return v ? `${tag}\n${v}` : tag;
}

function labScheduleLine(detail: InvoiceDetailModel): string {
  const preferred = detail.pharmacyPreferredSlotDisplay?.trim();
  if (preferred) return preferred;
  const firstSlot = detail.labSubOrders[0]?.dateSlotLine?.trim();
  if (firstSlot) return firstSlot;
  const req = detail.labBookingRequestedDisplay?.trim();
  if (req) return req;
  return detail.orderDateTimeDisplay?.trim() || "—";
}

/** Lab / diagnostics invoice after payment on order detail or partner pay. */
export function buildLabBookingSuccessFromInvoice(detail: InvoiceDetailModel): BookingSuccessLocationState {
  const inv = detail.id.trim();
  const routeId = detail.consultationInfoId?.trim() || inv;

  return {
    layout: "summary",
    title: "Booking successful",
    description: DEFAULT_SUB,
    summaryCardTitle: "Appointment summary",
    summaryRows: [
      { label: "Order ID", value: orderReferenceDisplayFromDetail(detail) },
      { label: "Booked for", value: detail.bookedForName?.trim() || "—" },
      { label: "Service", value: serviceLineFromItems(detail) },
      { label: "Location", value: labLocationLine(detail) },
      { label: "Schedule", value: labScheduleLine(detail) },
    ],
    orderDetailCategoryKey: "lab",
    orderDetailInvoiceId: routeId || undefined,
  };
}

function consultationLocationLine(detail: InvoiceDetailModel): string {
  if (!detail.isConsultationOrder) return labLocationLine(detail);
  if (detail.consultationPlaceTag === "virtual") {
    const doc =
      detail.consultationOrderDoctor?.name?.trim() ||
      detail.consultationBooking?.doctorName?.trim();
    const spec = detail.consultationBooking?.specialty?.trim();
    const lines: string[] = ["Online"];
    if (doc) lines.push(doc);
    if (spec && spec !== "—") lines.push(spec);
    return lines.join("\n");
  }
  const b = detail.consultationBooking;
  const clinic = b?.clinicName?.trim();
  const addr = b?.addressLine?.trim();
  if (clinic && addr) return `${clinic}\n${addr}`;
  if (clinic) return clinic;
  if (addr) return addr;
  return detail.vendorName?.trim() || "—";
}

function consultationScheduleLine(detail: InvoiceDetailModel): string {
  const s = detail.consultationBooking?.scheduleDisplay?.trim();
  if (s) return s;
  return detail.orderDateTimeDisplay?.trim() || "—";
}

function consultationServiceLine(detail: InvoiceDetailModel): string {
  const spec = detail.consultationBooking?.specialty?.trim();
  if (spec && spec !== "—") return spec;
  return serviceLineFromItems(detail);
}

/**
 * Consultation booking straight from overview (virtual / hospital) when API response has no full
 * {@link InvoiceDetailModel} yet — same summary card as order-detail payment success.
 */
export function buildInlineConsultationBookingSuccessState(args: {
  readonly infoOrderId: string | null;
  readonly invoiceIdForOrderDetail: string | null;
  readonly bookedForName: string;
  readonly serviceLine: string;
  readonly locationValue: string;
  readonly scheduleDisplay: string;
}): BookingSuccessLocationState {
  const orderDisplay = args.infoOrderId?.trim()
    ? `#${args.infoOrderId.replace(/^#/, "")}`
    : "—";
  return {
    layout: "summary",
    title: "Booking successful",
    description: DEFAULT_SUB,
    summaryCardTitle: "Appointment summary",
    summaryRows: [
      { label: "Order ID", value: orderDisplay },
      { label: "Booked for", value: args.bookedForName.trim() || "—" },
      { label: "Service", value: args.serviceLine.trim() || "—" },
      { label: "Location", value: args.locationValue.trim() || "—" },
      { label: "Schedule", value: args.scheduleDisplay.trim() || "—" },
    ],
    orderDetailCategoryKey: "consultation",
    orderDetailInvoiceId: args.invoiceIdForOrderDetail?.trim() || undefined,
  };
}

/** Consultation invoice after payment — same summary shell as lab. */
export function buildConsultationBookingSuccessFromInvoice(
  detail: InvoiceDetailModel,
): BookingSuccessLocationState {
  const inv = detail.id.trim();

  return {
    layout: "summary",
    title: "Booking successful",
    description: DEFAULT_SUB,
    summaryCardTitle: "Appointment summary",
    summaryRows: [
      { label: "Order ID", value: orderReferenceDisplayFromDetail(detail) },
      { label: "Booked for", value: detail.bookedForName?.trim() || "—" },
      { label: "Service", value: consultationServiceLine(detail) },
      { label: "Location", value: consultationLocationLine(detail) },
      { label: "Schedule", value: consultationScheduleLine(detail) },
    ],
    orderDetailCategoryKey: "consultation",
    orderDetailInvoiceId: inv || undefined,
  };
}
