/** Minimal Razorpay Checkout.js typings (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration). */

export type RazorpayPaymentSuccess = Readonly<{
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}>;

export type RazorpayCheckoutOptions = Readonly<{
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  handler: (response: RazorpayPaymentSuccess) => void;
  prefill?: Readonly<{
    name?: string;
    email?: string;
    contact?: string;
  }>;
  theme?: Readonly<{ color?: string }>;
  modal?: Readonly<{ ondismiss?: () => void }>;
}>;

export type RazorpayInstance = Readonly<{
  open: () => void;
  on: (event: string, handler: (data: unknown) => void) => void;
}>;

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

export {};
