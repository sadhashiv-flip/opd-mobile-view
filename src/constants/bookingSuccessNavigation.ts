/** One row in the reusable appointment summary card (any service). */
export type BookingSuccessSummaryRow = Readonly<{ label: string; value: string }>;

/**
 * Optional `location.state` for {@link BookingSuccessPage} (card layout or consult layout overrides).
 */
export type BookingSuccessLocationState = Readonly<{
  /**
   * Card layout: main heading / body.
   * Consult layout: overrides default lines when `layout === "consult"` or on consult success URLs.
   * Summary layout: heading + summary card + View order / Done (see `summaryRows`).
   */
  title?: string;
  description?: string;
  /**
   * `"consult"` — Lottie + Alright. `"card"` — My Orders / Back to Home.
   * `"summary"` — appointment summary card + outlined primary + Done (see `summaryRows`).
   * Ignored when URL is already a dedicated consult-success path (unless `summaryRows` present).
   */
  layout?: "consult" | "card" | "summary";
  /** Section title above label/value rows; default “Appointment summary”. */
  summaryCardTitle?: string;
  /** When set (typically with `layout: "summary"`), shows the detailed success screen. */
  summaryRows?: readonly BookingSuccessSummaryRow[];
  /** Build “View order details” via {@link pathToOrderDetail} when set with `orderDetailInvoiceId`. */
  orderDetailCategoryKey?: string;
  orderDetailInvoiceId?: string;
  /** If set, “View order details” navigates here instead of deriving from category + invoice. */
  viewOrderDetailPath?: string;
  /** “Done” target; defaults to dashboard. */
  doneNavigateTo?: string;
}>;

/** Card layout defaults (diagnostics without `type`, or unknown `type`). */
export const DEFAULT_BOOKING_SUCCESS_TITLE = "Appointment booked successfully!";

export const DEFAULT_BOOKING_SUCCESS_DESCRIPTION =
  "Your appointment has been confirmed. You can track it in My Orders.";

const DIAG_TYPE_LAB = "lab-tests";
const DIAG_TYPE_HEALTH = "health-checkups";

/** Card layout copy for `/diagnostics/:type/booking-success`. */
export function resolveDiagnosticsBookingSuccessCardCopy(
  typeSlug: string | undefined,
): Readonly<{ title: string; description: string }> {
  const t = (typeSlug ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (t === DIAG_TYPE_LAB) {
    return {
      title: "Appointment booked successfully!",
      description: "Your lab tests appointment has been booked. You can track it in My Orders.",
    };
  }
  if (t === DIAG_TYPE_HEALTH) {
    return {
      title: "Booking confirmed",
      description:
        "Your health checkup order has been placed successfully. You can track it in My Orders.",
    };
  }
  return {
    title: DEFAULT_BOOKING_SUCCESS_TITLE,
    description: DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
  };
}

/** Partner / generic `navigate(bookingSuccess, { layout: 'consult' })` when no custom `description` is passed. */
export const DEFAULT_CONSULT_SUCCESS_SUB_GENERIC_BOOKING =
  "Your appointment has been booked successfully.";

/** Consult layout (Lottie + Alright) — same structure as at-hospital */
export const DEFAULT_CONSULT_SUCCESS_TITLE = "Appointment Booked!";

export const DEFAULT_CONSULT_SUCCESS_SUB_HOSPITAL = "Appointment booked successfully.";

export const DEFAULT_CONSULT_SUCCESS_SUB_VIRTUAL = "Virtual consultation appointment booked successfully.";

export const DEFAULT_CONSULT_SUCCESS_SUB_DENTAL = "Dental appointment booked successfully.";

export const DEFAULT_CONSULT_SUCCESS_SUB_VISION = "Eye checkup appointment booked successfully.";

/** Vision booking success subline when `visionType` is `glasses-lens`. */
export const DEFAULT_CONSULT_SUCCESS_SUB_VISION_GLASSES_LENS = "Glasses/Lens appointment booked successfully.";

function isSummaryRow(value: unknown): value is BookingSuccessSummaryRow {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return typeof o.label === "string" && typeof o.value === "string";
}

/**
 * Builds location state for the appointment summary success screen (`/services/booking-success`).
 * Legacy `{ layout: "consult" }` from order payment is folded into summary (title/description only unless rows provided).
 */
export function mergeGenericBookingSuccessState(
  rawState: unknown,
  fallbacks: Readonly<{ title: string; description: string }>,
): BookingSuccessLocationState {
  const s = isBookingSuccessLocationState(rawState) ? rawState : undefined;
  return {
    layout: "summary",
    title: s?.title?.trim() || fallbacks.title,
    description: s?.description?.trim() || fallbacks.description,
    summaryCardTitle: s?.summaryCardTitle,
    summaryRows: s?.summaryRows,
    orderDetailCategoryKey: s?.orderDetailCategoryKey,
    orderDetailInvoiceId: s?.orderDetailInvoiceId,
    viewOrderDetailPath: s?.viewOrderDetailPath,
    doneNavigateTo: s?.doneNavigateTo,
  };
}

export function isBookingSuccessLocationState(value: unknown): value is BookingSuccessLocationState {
  if (value == null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.title != null && typeof o.title !== "string") return false;
  if (o.description != null && typeof o.description !== "string") return false;
  if (
    o.layout != null &&
    o.layout !== "consult" &&
    o.layout !== "card" &&
    o.layout !== "summary"
  ) {
    return false;
  }
  if (o.summaryCardTitle != null && typeof o.summaryCardTitle !== "string") return false;
  if (o.summaryRows != null) {
    if (!Array.isArray(o.summaryRows)) return false;
    for (const row of o.summaryRows) {
      if (!isSummaryRow(row)) return false;
    }
  }
  if (o.orderDetailCategoryKey != null && typeof o.orderDetailCategoryKey !== "string") return false;
  if (o.orderDetailInvoiceId != null && typeof o.orderDetailInvoiceId !== "string") return false;
  if (o.viewOrderDetailPath != null && typeof o.viewOrderDetailPath !== "string") return false;
  if (o.doneNavigateTo != null && typeof o.doneNavigateTo !== "string") return false;
  return true;
}
