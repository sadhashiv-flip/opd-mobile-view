/** After Checkout.js `handler` — matches Angular `payment.done` (consultation, RF lab book, orders). */
export const PAYMENT_DONE_EVENT = "payment.done" as const;

/** Lab overview / invoice-style flows in Angular (distinct listener name). */
export const PAYMENT_SUCCESS_EVENT = "payment.success" as const;

/** Gym opt-in verify listener. */
export const GYM_PAYMENT_DONE_EVENT = "gym.payment.done" as const;
