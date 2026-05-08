import type { ComponentType, SVGProps } from "react";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
/** Synced from patient-app `assets/svg/all services icons/` → `patient-app/hub/`. */
import bookConsultationSvg from "@/assets/icons/patient-app/hub/services/bookConsultations.svg";
import bookDiagnosticSvg from "@/assets/icons/patient-app/hub/services/bookDaignostics.svg";
import chronicManagementSvg from "@/assets/icons/patient-app/hub/services/chronicManagement.svg";
import dentalServicesSvg from "@/assets/icons/patient-app/hub/services/dentalServices.svg";
import gymAndFitnessSvg from "@/assets/icons/patient-app/hub/services/gymAndFitness.svg";
import mentalWellnessSvg from "@/assets/icons/patient-app/hub/services/mentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/patient-app/hub/services/nutritionServices.svg";
import prescribedPharmacySvg from "@/assets/icons/patient-app/hub/services/prescribedPharmacy.svg";
import vaccinationServicesSvg from "@/assets/icons/patient-app/hub/services/vaccinationServices.svg";
import visionServicesSvg from "@/assets/icons/patient-app/hub/services/visionServices.svg";
import viewServicesSvg from "@/assets/icons/patient-app/hub/tab_bar_icons/services.svg";

import hubTabOpdClaimsSvg from "@/assets/icons/patient-app/hub/tab_bar_icons/opd_claims.svg";
import opdClaimsClaimsSvg from "@/assets/icons/patient-app/hub/opd/claims.svg";
import opdClaimsBankDetailsSvg from "@/assets/icons/patient-app/hub/opd/bank_details.svg";

import hubTabAccountSvg from "@/assets/icons/patient-app/hub/tab_bar_icons/account_management.svg";
import accountProfileSvg from "@/assets/icons/patient-app/hub/account_management/profile.svg";
import accountSubscriptionsSvg from "@/assets/icons/patient-app/hub/account_management/subscriptions.svg";
import accountFamilyAccountsSvg from "@/assets/icons/patient-app/hub/account_management/family_account.svg";
import accountAddressBookSvg from "@/assets/icons/patient-app/hub/account_management/address_book.svg";
import accountOrdersSvg from "@/assets/icons/patient-app/hub/account_management/oders.svg";
import accountDeleteAccountSvg from "@/assets/icons/patient-app/hub/account_management/delete_account.svg";

import hubTabHelpSupportSvg from "@/assets/icons/patient-app/hub/help_and_support/support.svg";
import helpFaqSvg from "@/assets/icons/patient-app/hub/help_and_support/faq.svg";
import helpTandCSvg from "@/assets/icons/patient-app/hub/help_and_support/terms_and_conditions.svg";
import helpPrivacyAndPoliciesSvg from "@/assets/icons/patient-app/hub/help_and_support/privacy_policy.svg";
import hubTabMedicalRecordsSvg from "@/assets/icons/patient-app/hub/medical_records.svg";
import mrAppointmentsSvg from "@/assets/icons/patient-app/hub/medical_records/my_appointments.svg";
import helpLabReportsSvg from "@/assets/icons/patient-app/hub/medical_records/lab_reports.svg";
import helpMyPrescriptionsSvg from "@/assets/icons/patient-app/hub/medical_records/my_prescription.svg";
import helpActivitiesSvg from "@/assets/icons/patient-app/hub/medical_records/activities.svg";

export type HubTabId =
  | "services"
  | "opd-claims"
  | "account"
  | "help"
  | "medical-records";

export const HUB_TAB_IDS: readonly HubTabId[] = [
  "services",
  "opd-claims",
  "account",
  "help",
  "medical-records",
];

export function isHubTabId(s: string): s is HubTabId {
  return (HUB_TAB_IDS as readonly string[]).includes(s);
}

export type HubTab = Readonly<{
  id: HubTabId;
  label: string;
  /** Raster/SVG from `patient-app/hub` — used instead of `Icon` when set */
  iconSrc?: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
}>;

export const HUB_TABS: readonly HubTab[] = [
  { id: "services", label: "Services", iconSrc: viewServicesSvg },
  { id: "opd-claims", label: "OPD Claims", iconSrc: hubTabOpdClaimsSvg },
  { id: "account", label: "Account Management", iconSrc: hubTabAccountSvg },
  { id: "help", label: "Help & Support", iconSrc: hubTabHelpSupportSvg },
  {
    id: "medical-records",
    label: "medical Records",
    iconSrc: hubTabMedicalRecordsSvg,
  },
];

export type HubCardItem = Readonly<{
  id: string;
  title: string;
  description: string;
  /** SVG from `patient-app/hub` for hub category tiles */
  iconSrc?: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: "new";
}>;

export const SERVICES_MAIN_ITEMS: readonly HubCardItem[] = [
  {
    id: "diag",
    title: "Book Diagnostics",
    description: "Book lab tests/health check ups",
    iconSrc: bookDiagnosticSvg,
  },
  {
    id: "consult",
    title: "Book Consultation",
    description: "Book virtual / inperson consultations",
    iconSrc: bookConsultationSvg,
  },
  {
    id: "dental",
    title: "Dental Services",
    description: "Book dental services",
    iconSrc: dentalServicesSvg,
  },
  {
    id: "pharm",
    title: "Prescribed Pharmacy",
    description: "Buy prescribed / OTC medicines",
    iconSrc: prescribedPharmacySvg,
  },
  {
    id: "vax",
    title: "Vaccination Services",
    description: "Book vaccination at home/center",
    iconSrc: vaccinationServicesSvg,
    badge: "new",
  },
  {
    id: "vision",
    title: "Vision Services",
    description: "Book vision services",
    iconSrc: visionServicesSvg,
  },
  {
    id: "mental",
    title: "Mental Wellness",
    description: "Book mental wellness sessions",
    iconSrc: mentalWellnessSvg,
  },
  {
    id: "chronic",
    title: "Chronic Management",
    description: "Chronic medication and buy chronic medicine",
    iconSrc: chronicManagementSvg,
    badge: "new",
  },
  {
    id: "nutrition",
    title: "Nutrition Services",
    description: "Nutrition and dietician expert service",
    iconSrc: nutritionServicesSvg,
  },
  {
    id: "fitness",
    title: "Fitness",
    description: "Fitness programs and health club",
    iconSrc: gymAndFitnessSvg,
  },
  {
    id: "gym",
    title: "Gym Membership",
    description: "Buy gym membership",
    iconSrc: gymAndFitnessSvg,
  },
];

export const OPD_CLAIMS_ITEMS: readonly HubCardItem[] = [
  {
    id: "claims",
    title: "Claims",
    description: "Raise claims, check status",
    iconSrc: opdClaimsClaimsSvg,
  },
  {
    id: "bank",
    title: "Bank Details",
    description: "Add/edit bank details",
    iconSrc: opdClaimsBankDetailsSvg,
  },
];

export const ACCOUNT_ITEMS: readonly HubCardItem[] = [
  {
    id: "profile",
    title: "Profile",
    description: "Manage profile details",
    iconSrc: accountProfileSvg,
  },
  {
    id: "subs",
    title: "Subscriptions",
    description: "Manage subscriptions",
    iconSrc: accountSubscriptionsSvg,
  },
  {
    id: "family",
    title: "Family Accounts",
    description: "Manage family members",
    iconSrc: accountFamilyAccountsSvg,
  },
  {
    id: "address",
    title: "Address Book",
    description: "Manage address details",
    iconSrc: accountAddressBookSvg,
  },
  {
    id: "orders",
    title: "Orders",
    description: "Check order status",
    iconSrc: accountOrdersSvg,
  },
  {
    id: "delete",
    title: "Delete Account",
    description: "Delete your and family accounts",
    iconSrc: accountDeleteAccountSvg,
  },
];

export const HELP_ITEMS: readonly HubCardItem[] = [
  {
    id: "support",
    title: "Support",
    description: "For any queries or support tickets",
    iconSrc: hubTabHelpSupportSvg,
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Refer FAQs here",
    iconSrc: helpFaqSvg,
  },
  {
    id: "tc",
    title: "T&C",
    description: "Read all the Terms & Conditions here",
    iconSrc: helpTandCSvg,
  },
  {
    id: "privacy",
    title: "Privacy Policies",
    description: "Refer all the privacy policies here",
    iconSrc: helpPrivacyAndPoliciesSvg,
  },
];

export const MEDICAL_RECORDS_ITEMS: readonly HubCardItem[] = [
  {
    id: "appts",
    title: "My Appointments",
    description: "Check your appointments history/status here",
    iconSrc: mrAppointmentsSvg,
  },
  {
    id: "lab",
    title: "Lab Reports",
    description: "Check your lab test reports here",
    iconSrc: helpLabReportsSvg,
  },
  {
    id: "rx",
    title: "My Prescriptions",
    description: "Check your prescriptions here",
    iconSrc: helpMyPrescriptionsSvg,
    badge: "new",
  },
  {
    id: "activity",
    title: DIGITAL_DIARY_COPY.appBarTitle,
    description: DIGITAL_DIARY_COPY.helpHubDigitalDiaryDescription,
    iconSrc: helpActivitiesSvg,
  },
];

export function getHubHeading(tabId: HubTabId): string {
  const t = HUB_TABS.find((x) => x.id === tabId);
  return t?.label ?? "Services";
}

export function getHubItems(tabId: HubTabId): readonly HubCardItem[] {
  switch (tabId) {
    case "services":
      return SERVICES_MAIN_ITEMS;
    case "opd-claims":
      return OPD_CLAIMS_ITEMS;
    case "account":
      return ACCOUNT_ITEMS;
    case "help":
      return HELP_ITEMS;
    case "medical-records":
      return MEDICAL_RECORDS_ITEMS;
    default:
      return SERVICES_MAIN_ITEMS;
  }
}
