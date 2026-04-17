/**
 * Optional `location.state` for {@link BookingSuccessPage} (card layout or consult layout overrides).
 */
export type BookingSuccessLocationState = Readonly<{
  /**
   * Card layout: main heading / body.
   * Consult layout: overrides default lines when `layout === "consult"` or on consult success URLs.
   */
  title?: string;
  description?: string;
  /**
   * `"consult"` — Lottie + Alright (same as at-hospital success). `"card"` — My Orders / Back to Home.
   * Ignored when URL is already a dedicated consult-success path.
   */
  layout?: "consult" | "card";
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
      title: "Appointment booked successfully!",
      description: "Your health checkup appointment has been booked. You can track it in My Orders.",
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

export function isBookingSuccessLocationState(value: unknown): value is BookingSuccessLocationState {
  if (value == null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.title != null && typeof o.title !== "string") return false;
  if (o.description != null && typeof o.description !== "string") return false;
  if (o.layout != null && o.layout !== "consult" && o.layout !== "card") return false;
  return true;
}
