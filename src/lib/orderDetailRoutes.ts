import { categoryKeyFromLabel } from "@/api/patientInvoices";
import { ROUTES } from "@/constants";
import { generatePath, type NavigateFunction } from "react-router-dom";

/** Passed via `navigate(..., { state })` when opening detail from a booking-success screen. */
export type OrderDetailLocationState = Readonly<{
  fromBookingSuccess?: boolean;
}>;

export const ORDER_DETAIL_FROM_BOOKING_SUCCESS: OrderDetailLocationState = {
  fromBookingSuccess: true,
};

export function isOrderDetailFromBookingSuccess(state: unknown): boolean {
  if (state == null || typeof state !== "object" || Array.isArray(state)) return false;
  return (state as OrderDetailLocationState).fromBookingSuccess === true;
}

/** Path param `orderKind` for {@link ROUTES.ordersDetail} (kebab-case where needed). */
export type OrderDetailKindInUrl =
  | "consultation"
  | "lab"
  | "pharmacy"
  | "dental"
  | "vision"
  | "vaccine"
  | "gym"
  | "mental-wellness"
  | "nutrition"
  | "other";

const CATEGORY_KEY_TO_URL: Readonly<Record<string, OrderDetailKindInUrl>> = {
  consultation: "consultation",
  lab: "lab",
  pharmacy: "pharmacy",
  dental: "dental",
  vision: "vision",
  vaccine: "vaccine",
  gym: "gym",
  mental_wellness: "mental-wellness",
  nutrition: "nutrition",
  other: "other",
};

export function orderDetailKindInUrlFromCategoryKey(categoryKey: string): OrderDetailKindInUrl {
  return CATEGORY_KEY_TO_URL[categoryKey] ?? "other";
}

/** Builds `/order/:orderKind/:invoiceId` from list row / detail `categoryKey`. */
export function pathToOrderDetail(categoryKey: string, invoiceId: string): string {
  return generatePath(ROUTES.ordersDetail, {
    orderKind: orderDetailKindInUrlFromCategoryKey(categoryKey),
    invoiceId,
  });
}

/** Order success “View order details” — back on detail should land on orders, not success. */
export function navigateToOrderDetailFromBookingSuccess(
  navigate: NavigateFunction,
  path: string,
): void {
  void navigate(path, {
    replace: true,
    state: ORDER_DETAIL_FROM_BOOKING_SUCCESS,
  });
}

/**
 * Home dashboard “ongoing” rows do not carry `categoryKey`; derive the same segment as the orders list
 * using `type` / `order_type` (consultation appointments are `APPOINTMENT`).
 */
export function orderDetailKindInUrlFromDashboardOngoing(item: {
  readonly type: string;
  readonly orderType: string;
}): OrderDetailKindInUrl {
  if (item.orderType.trim().toUpperCase() === "APPOINTMENT") {
    return "consultation";
  }
  const key = categoryKeyFromLabel(`${item.type} ${item.orderType}`);
  return orderDetailKindInUrlFromCategoryKey(key);
}
