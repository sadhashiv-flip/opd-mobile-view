/** Application route paths — single source of truth for navigation (OCP: extend here). */
export const ROUTES = {
  root: "/",
  login: "/login",
  otp: "/otp",
  dashboard: "/dashboard",
  services: "/services",
  healthCheckups: "/health-checkups",
  addFamilyMember: "/health-checkups/add-family-member",
  healthCheckupsPlan: "/health-checkups/plan",
  diagnosticsScreen: "/health-checkups/diagnostics",
  diagnosticsSlots: "/health-checkups/diagnostics/slots",
  healthCheckupsOverview: "/health-checkups/overview",
  bookingSuccess: "/health-checkups/booking-success",
  consultation: "/consultation/:type", // type: virtual, hospital
  dental: "/dental",
  vision: "/vision",
  pharmacy: "/pharmacy",
  orders: "/orders",
  help: "/help",
  gymMembership: "/gym-membership",
  gymMembershipSelectPeople: "/gym-membership/select-people",
  gymMembershipConfigure: "/gym-membership/configure",
  gymMembershipOverview: "/gym-membership/overview",
  gymMembershipSelectClinic: "/gym-membership/select-clinic",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
