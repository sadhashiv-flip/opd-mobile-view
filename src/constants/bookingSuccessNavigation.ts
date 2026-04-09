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

/** Card layout (e.g. diagnostics) defaults */
export const DEFAULT_BOOKING_SUCCESS_TITLE = "Appointment booking successfully.";

export const DEFAULT_BOOKING_SUCCESS_DESCRIPTION =
  "Your booking has been confirmed. You can track it in My Orders.";

/** Consult layout (Lottie + Alright) — same structure as at-hospital */
export const DEFAULT_CONSULT_SUCCESS_TITLE = "Appointment Booked!";

export const DEFAULT_CONSULT_SUCCESS_SUB_HOSPITAL = "Appointment booked successfully.";

export const DEFAULT_CONSULT_SUCCESS_SUB_VIRTUAL = "Virtual consultation booked successfully.";

export const DEFAULT_CONSULT_SUCCESS_SUB_DENTAL = "Dental Service booking successfully.";

export function isBookingSuccessLocationState(value: unknown): value is BookingSuccessLocationState {
  if (value == null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.title != null && typeof o.title !== "string") return false;
  if (o.description != null && typeof o.description !== "string") return false;
  if (o.layout != null && o.layout !== "consult" && o.layout !== "card") return false;
  return true;
}
