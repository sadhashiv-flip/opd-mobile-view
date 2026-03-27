/** Application route paths — single source of truth for navigation (OCP: extend here). */
export const ROUTES = {
  root: "/",
  login: "/login",
  otp: "/otp",
  dashboard: "/dashboard",
  services: "/services",
  pharmacy: "/pharmacy",
  orders: "/orders",
  help: "/help",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
