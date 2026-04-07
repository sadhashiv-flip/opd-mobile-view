/** Application route paths — single source of truth for navigation (OCP: extend here). */
export const ROUTES = {
  /** Onboarding carousel; use `login` for the auth screen. */
  root: "/",
  login: "/login",
  otp: "/otp",
  /** Onboarding when verify returns `isReg: false` (personal info → BMI). */
  userDetailsPersonal: "/user-details/personal",
  userDetailsBmi: "/user-details/bmi",
  userDetailsBmiResult: "/user-details/bmi/result",
  /** Link phone/email after verify when API returns `link`: PHONE | EMAIL */
  accountLink: "/account/link",
  dashboard: "/dashboard",
  profile: "/profile",
  profileBank: "/profile/bank",
  profileBankAdd: "/profile/bank/add",
  profileBankView: "/profile/bank/view/:bankId",
  profileBankEdit: "/profile/bank/edit/:bankId",
  profileAddress: "/profile/address",
  profileAddressAdd: "/profile/address/add",
  profileAddressEdit: "/profile/address/edit/:addressId",
  profileMembers: "/profile/members",
  /** Single add-member flow; legacy `/Diagnostics/.../add-family-member` URLs redirect here. */
  profileMembersAdd: "/profile/members/add",
  profileMembersEdit: "/profile/members/edit/:memberId",
  profileSubscriptions: "/profile/subscriptions",
  services: "/services",
  /** Services hub, Help & Support tab — same screen as bottom nav “Need Help?”. */
  servicesHelpTab: "/services?tab=help",
  /** Services hub, Medical Records tab — bottom nav “Medical Records”. */
  servicesMedicalRecordsTab: "/services?tab=medical-records",
  diagnosticsType: "/diagnostics/:type",
  diagnosticsSelectPeople: "/diagnostics/:type/select-people",
  diagnosticsAddFamilyMember: "/diagnostics/:type/add-family-member",
  diagnosticsPlan: "/diagnostics/:type/plan",
  diagnosticsVendors: "/diagnostics/:type/vendors",
  diagnosticsSlots: "/diagnostics/:type/slots",
  diagnosticsOverview: "/diagnostics/:type/overview",
  diagnosticsBookingSuccess: "/diagnostics/:type/booking-success",
  /** Entry from home: `/consultation/at_hospital` or `/consultation/virtual` → ConsultationEntryRedirect → select-people. */
  consultation: "/consultation/:type",
  consultationType: "/consultation/type",
  consultationAddFamilyMember: "/consultation/:type/add-family-member",
  consultationSelectPeople: "/consultation/:type/select-people",
  consultationSpecialties: "/consultation/:type/specialties",
  /** Virtual: slots + Top Doctors after choosing a specialty (issue id in path). */
  consultationVirtualSlots: "/consultation/virtual/specialties/:issueId/slots",
  consultationVirtualOverview: "/consultation/virtual/specialties/:issueId/overview",
  consultationHospitalResults: "/consultation/at_hospital/specialties/:specialtyId",
  consultationHospitalSlots:
    "/consultation/at_hospital/specialties/:specialtyId/appointment/:networkId/:doctorId",
  consultationHospitalOverview:
    "/consultation/at_hospital/specialties/:specialtyId/appointment/:networkId/:doctorId/overview",
  /** After `POST /appointment/network_book` succeeds. */
  consultationHospitalBookingSuccess: "/consultation/at_hospital/booking-success",
  dental: "/dental",
  vision: "/vision",
  pharmacy: "/pharmacy",
  orders: "/orders",
  /** Invoice / order detail — `GET /invoice/:invoiceId`. */
  ordersDetail: "/orders/:invoiceId",
  /** Legacy path; AppRoutes redirects to `servicesHelpTab`. */
  help: "/help",
  gymMembership: "/services/gym-membership",
  gymMembershipSelectPeople: "/services/gym-membership/select-people",
  gymMembershipConfigure: "/services/gym-membership/configure",
  gymMembershipOverview: "/services/gym-membership/overview",
  gymMembershipSelectClinic: "/services/gym-membership/select-clinic",
  /**
   * Mental Wellness vs Diet & Nutrition request form — same screen; `wellnessKind` is
   * `mental-wellness` | `nutrition` (see {@link WELLNESS_SESSION_KIND}).
   */
  servicesWellness: "/services/wellness/:wellnessKind",
  /** Help tab: open ticket thread (chat + attachments). */
  servicesSupportTicketChat: "/services/support/ticket/:ticketId",
  cartOverview: "/cart-overview",
} as const;

/** Path param for {@link ROUTES.servicesWellness}. */
export const WELLNESS_SESSION_KIND = {
  mentalWellness: "mental-wellness",
  nutrition: "nutrition",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
