import { GYM_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import { openRazorpayCheckoutWithEvent } from "@/lib/razorpayCheckout";

export { isPaymentCancelledMessage, loadRazorpayScript } from "@/lib/razorpayCheckout";

/**
 * Opens Razorpay Checkout for gym; success dispatches {@link GYM_PAYMENT_DONE_EVENT} on `window`.
 */
export function openRazorpayCheckout(
  razorpayPayload: Record<string, unknown>,
  onPaymentFailed: (message: string) => void,
): void {
  openRazorpayCheckoutWithEvent(razorpayPayload, GYM_PAYMENT_DONE_EVENT, onPaymentFailed);
}
