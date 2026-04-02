/** Application route paths — single source of truth for navigation (OCP: extend here). */
export const ROUTES = {
  /** Onboarding carousel; use `login` for the auth screen. */
  root: "/",
  login: "/login",
  otp: "/otp",
  dashboard: "/dashboard",
  profile: "/profile",
  services: "/services",
  diagnosticsType: "/Diagnostics/:type",
  diagnosticsAddFamilyMember: "/Diagnostics/:type/add-family-member",
  diagnosticsPlan: "/Diagnostics/:type/plan",
  diagnosticsVendors: "/Diagnostics/:type/vendors",
  diagnosticsSlots: "/Diagnostics/:type/slots",
  diagnosticsOverview: "/Diagnostics/:type/overview",
  diagnosticsBookingSuccess: "/Diagnostics/:type/booking-success",
  consultation: "/consultation/:type",
  consultationAddFamilyMember: "/consultation/:type/add-family-member",
  consultationSpecialties: "/consultation/:type/specialties",
  /** Virtual: slots + Top Doctors after choosing a specialty (issue id in path). */
  consultationVirtualSlots: "/consultation/virtual/specialties/:issueId/slots",
  consultationHospitalResults: "/consultation/at_hospital/specialties/:specialtyId",
  consultationHospitalSlots: "/consultation/at_hospital/specialties/:specialtyId/appointment/:doctorId",
  consultationHospitalOverview: "/consultation/at_hospital/specialties/:specialtyId/appointment/:doctorId/overview",
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
  cartOverview: "/cart-overview",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
