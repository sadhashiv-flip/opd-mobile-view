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
  /**
   * Shown when GET `/required_lab_tests` indicates `required_test` or `access_block` is true
   * (after OTP/password verify). Placeholder for the full lab flow.
   */
  requiredLabTests: "/required-lab-tests",
  dashboard: "/dashboard",
  /** Patient video room; `appointmentId` is the ongoing appointment id (e.g. `APP…T…`) for join/end/chat/feedback. */
  videoCall: "/video/:appointmentId",
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
  /** After virtual consultation booking succeeds. */
  consultationVirtualBookingSuccess: "/consultation/virtual/booking-success",
  dental: "/dental",
  /** Dental booking: member selection (from home / dashboard Dental card). */
  dentalSelectPeople: "/services/dental/select-people",
  /** Dental booking: clinic network list for chosen address. */
  dentalNetworkList: "/services/dental/network-list",
  /** Dental booking: date & time slots for selected clinic. */
  dentalSlots: "/services/dental/slots",
  /** Dental booking: summary before confirm. */
  dentalOverview: "/services/dental/overview",
  /** Dental booking success — same consult-style screen as at-hospital / virtual. */
  dentalBookingSuccess: "/services/dental/booking-success",
  /** Generic booking success — pass `BookingSuccessLocationState` via `navigate(..., { state })`. */
  bookingSuccess: "/services/booking-success",
  vision: "/vision",
  /**
   * Vision sub-flows (same pattern as {@link ROUTES.consultation} `/:type`).
   * Path param `visionType`: `eye-checkup` | `glasses-lens` — use {@link VISION_ROUTE_TYPE}.
   */
  visionSelectPeople: "/services/vision/:visionType/select-people",
  /** Clinic / store network list — `service=vision.clinic` vs `vision.store` from subtype. */
  visionNetworkList: "/services/vision/:visionType/network-list",
  /** Vision slots from `GET /service/slots` after choosing a network location. */
  visionSlots: "/services/vision/:visionType/slots",
  /** Glasses/lens: upload prescription after choosing a slot (`visionType` = `glasses-lens`). */
  visionAddPrescription: "/services/vision/:visionType/add-prescription",
  /** Vision booking summary (eye-checkup flow; mirrors dental overview). */
  visionOverview: "/services/vision/:visionType/overview",
  /** After vision confirm — same consult-style success as dental. */
  visionBookingSuccess: "/services/vision/:visionType/booking-success",
  pharmacy: "/pharmacy",
  pharmacyUpload: "/pharmacy/upload",
  pharmacySelectPrescription: "/pharmacy/select-prescription",
  pharmacyPrescriptionDetail: "/pharmacy/prescription/:prescriptionId",
  pharmacyOrderSuccess: "/pharmacy/order-success",
  orders: "/orders",
  /** OPD wallet: resolves subscription then redirects to {@link ROUTES.walletSubscription}. */
  wallet: "/wallet",
  /** Wallet home: balance, module breakup, recent transactions. */
  walletSubscription: "/wallet/:subscriptionId",
  /** Paginated transactions + filters. */
  walletTransactions: "/wallet/:subscriptionId/transactions",
  /**
   * Invoice / order detail — `GET /invoice/:invoiceId`.
   * Singular `order` path; `orderKind` is a segment (`consultation`, `gym`, `lab`, …); see {@link orderDetailKindInUrlFromCategoryKey}.
   */
  ordersDetail: "/order/:orderKind/:invoiceId",
  /** Bookmarks and deep links without a kind segment; detail page replaces with canonical {@link ROUTES.ordersDetail}. */
  ordersDetailLegacy: "/order/:invoiceId",
  /** Legacy path; AppRoutes redirects to `servicesHelpTab`. */
  help: "/help",
  gymMembership: "/services/gym-membership",
  gymMembershipSelectPeople: "/services/gym-membership/select-people",
  gymMembershipConfigure: "/services/gym-membership/configure",
  gymMembershipOverview: "/services/gym-membership/overview",
  gymMembershipSelectClinic: "/services/gym-membership/select-clinic",
  /** Vaccination booking: member → vaccine list → slots → overview. */
  vaccinationSelectPeople: "/services/vaccination/select-people",
  vaccinationChooseType: "/services/vaccination/choose-type",
  vaccinationSlots: "/services/vaccination/slots",
  vaccinationOverview: "/services/vaccination/overview",
  /**
   * Mental Wellness vs Diet & Nutrition request form — same screen; `wellnessKind` is
   * `mental-wellness` | `nutrition` (see {@link WELLNESS_SESSION_KIND}).
   */
  servicesWellness: "/services/wellness/:wellnessKind",
  /** Help tab: open ticket thread (chat + attachments). */
  servicesSupportTicketChat: "/services/support/ticket/:ticketId",
  cartOverview: "/cart-overview",
  /** In-app notification list; loads `GET /notification`. */
  notifications: "/notifications",
} as const;

/** Path param for {@link ROUTES.servicesWellness}. */
export const WELLNESS_SESSION_KIND = {
  mentalWellness: "mental-wellness",
  nutrition: "nutrition",
} as const;

/** Path param `visionType` for {@link ROUTES.visionSelectPeople} and {@link ROUTES.visionNetworkList}. */
export const VISION_ROUTE_TYPE = {
  eyeCheckup: "eye-checkup",
  glassesLens: "glasses-lens",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
