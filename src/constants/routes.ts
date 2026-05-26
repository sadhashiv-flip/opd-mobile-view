/** Application route paths — single source of truth for navigation (OCP: extend here). */
export const ROUTES = {
  /** Onboarding carousel; use `login` for the auth screen. */
  root: "/",
  login: "/login",
  /**
   * IAM / mobile redirect: `?token=<short-lived JWT>`. Exchanges for app session (mock or API).
   * Register this path with IAM as the provider redirect URL.
   */
  ssoLogin: "/sso-login",
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
  profileFaq: "/profile/faq",
  profilePrivacyPolicy: "/profile/privacy-policy",
  profileTerms: "/profile/terms-and-conditions",
  services: "/services",
  /** Services hub, Help & Support tab — same screen as bottom nav “Need Help?”. */
  servicesHelpTab: "/services?tab=help",
  /** Services hub, Medical Records tab — bottom nav “Medical Records”. */
  servicesMedicalRecordsTab: "/services?tab=medical-records",
  /** Medical history lists (`GET /patient/history/type/…`). */
  medicalRecords: "/medical-records",
  /** Consultation thread (`GET /patient/chat/messages/:appointmentId`, `POST /patient/chat/:appointmentId`). */
  medicalRecordsConsultationChat: "/medical-records/consultations/chat/:appointmentId",
  medicalRecordsCategory: "/medical-records/:categorySlug",
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
  /** Review before confirm — pass `location.state.orderKind` + {@link writePharmacyReviewDraft}. */
  pharmacyReview: "/pharmacy/review",
  pharmacyOrderSuccess: "/pharmacy/order-success",
  orders: "/orders",
  /**
   * Dev / QA only — enter an invoice id and navigate to {@link ROUTES.ordersDetail} with `lab`.
   * Does not replace going through Orders list; use for faster lab-detail UI checks.
   */
  devLabOrderDetail: "/dev/lab-order",
  /** Dev / QA — bookmark `/dev/lab-order/open/:invoiceId` → canonical `/order/lab/:invoiceId`. */
  devLabOrderDetailOpen: "/dev/lab-order/open/:invoiceId",
  /** OPD wallet: resolves subscription then redirects to {@link ROUTES.walletSubscription}. */
  wallet: "/wallet",
  /** Wallet home: balance, module breakup, recent transactions. */
  walletSubscription: "/wallet/:subscriptionId",
  /** Paginated transactions + filters. */
  walletTransactions: "/wallet/:subscriptionId/transactions",
  /** Digital diary (patient parameters) — hub + per-activity log; `activityType` matches Flutter API keys (`water`, `GL`, …). */
  digitalDiary: "/digital-diary",
  digitalDiaryLog: "/digital-diary/:activityType",
  /**
   * Invoice / order detail — `GET /invoice/:invoiceId`.
   * Singular `order` path; `orderKind` is a segment (`consultation`, `gym`, `lab`, …); see {@link orderDetailKindInUrlFromCategoryKey}.
   */
  ordersDetail: "/order/:orderKind/:invoiceId",
  /** Bookmarks and deep links without a kind segment; detail page replaces with canonical {@link ROUTES.ordersDetail}. */
  ordersDetailLegacy: "/order/:invoiceId",
  /** Legacy path; AppRoutes redirects to `servicesHelpTab`. */
  help: "/help",
  /**
   * Workout videos — `GET video/category` (list), `GET video/category/:tagId` (videos).
   * Parity with patient-webapp `fitness-routing.module.ts`.
   */
  fitness: "/services/fitness",
  fitnessTag: "/services/fitness/tag/:tagId",
  gymMembership: "/services/gym-membership",
  /** Location & contact per member — aligns with Flutter `GymLineContactScreen`. */
  gymMembershipContact: "/services/gym-membership/location-contact",
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
  /** Chronic management flow (program list → enroll/details). */
  chronic: "/services/chronic",
  chronicCondition: "/services/chronic/condition/:conditionId",
  chronicDetail: "/services/chronic/:conditionId",
  /** Help & Support — ticket list (patient_app `HelpScreen`). */
  servicesHelpSupport: "/services/help-support",
  /** Help tab: open ticket thread (chat + attachments). */
  servicesSupportTicketChat: "/services/support/ticket/:ticketId",
  cartOverview: "/cart-overview",
  /** In-app notification list; loads `GET /notification`. */
  notifications: "/notifications",
  /** Health Club articles — `GET /patient/blog` (Flutter “Health Club”). */
  healthClub: "/health-club",
  healthClubDetail: "/health-club/:blogId",
  /** OPD reimbursement claims list (`GET /patient/reimbursement`). */
  claims: "/claims",
  /** Multi-step new claim flow (`POST /patient/reimbursement`). */
  claimsNew: "/claims/new",
  /** Bill-level document checklist + uploads (returns to new claim with `checklistDone` state). */
  claimBillChecklist: "/claims/new/bill-checklist",
  /** Single claim detail (`GET /patient/reimbursement/:id`). */
  claimsDetail: "/claims/:claimId",
  /** Edit one bill on an existing claim (`PATCH /patient/reimbursement/bill/:billId`). */
  claimsBillEdit: "/claims/:claimId/bills/:billId/edit",
  /** Demo multi-step wizard — global FormContext + localStorage persistence. */
  wizard: "/wizard",
  wizardScreen1: "/wizard/screen-1",
  wizardScreen2: "/wizard/screen-2",
  wizardScreen3: "/wizard/screen-3",
  wizardScreen4: "/wizard/screen-4",
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
