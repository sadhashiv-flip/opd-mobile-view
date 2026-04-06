/** Razorpay Checkout.js success payload (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration). */

export type RazorpayPaymentSuccess = Readonly<{
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}>;

export type RazorpayInstance = Readonly<{
  open: () => void;
  on: (event: string, handler: (data: unknown) => void) => void;
}>;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export {};
