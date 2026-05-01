import type { ComponentType, SVGProps } from "react";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import bookConsultationSvg from "@/assets/icons/Services/BookConsultation.svg";
import bookDiagnosticSvg from "@/assets/icons/Services/BookDiagnostic.svg";
import chronicManagementSvg from "@/assets/icons/Services/ChronicManagement.svg";
import dentalServicesSvg from "@/assets/icons/Services/DentalServices.svg";
import gymAndFitnessSvg from "@/assets/icons/Services/GymAndFitness.svg";
import mentalWellnessSvg from "@/assets/icons/Services/MentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/Services/NutritionServices.svg";
import prescribedPharmacySvg from "@/assets/icons/Services/PrescribedPharmacy.svg";
import vaccinationServicesSvg from "@/assets/icons/Services/VaccinationServices.svg";
import visionServicesSvg from "@/assets/icons/Services/VissionServices.svg";
import viewServicesSvg from "@/assets/icons/Services/ViewServices.svg";

import opdClaimsMainMenuSvg from "@/assets/icons/OPDClaims/MainMenu.svg";
import opdClaimsClaimsSvg from "@/assets/icons/OPDClaims/Claims.svg";
import opdClaimsBankDetailsSvg from "@/assets/icons/OPDClaims/BankDetails.svg";

import accountMainMenuSvg from "@/assets/icons/AccountManagement/MainMenu.svg";
import accountProfileSvg from "@/assets/icons/AccountManagement/Profile.svg";
import accountSubscriptionsSvg from "@/assets/icons/AccountManagement/Subscriptions.svg";
import accountFamilyAccountsSvg from "@/assets/icons/AccountManagement/FamilyAccounts.svg";
import accountAddressBookSvg from "@/assets/icons/AccountManagement/AddressBook.svg";
import accountOrdersSvg from "@/assets/icons/AccountManagement/Orders.svg";
import accountSetPasswordSvg from "@/assets/icons/AccountManagement/SetPassword.svg";
import accountDeleteAccountSvg from "@/assets/icons/AccountManagement/DeleteAccount.svg";
import accountInvoicesSvg from "@/assets/icons/AccountManagement/Invoices.svg";

import helpMainMenuSvg from "@/assets/icons/HelpAndSupport/MainMenu.svg";
import helpSupportSvg from "@/assets/icons/HelpAndSupport/Support.svg";
import helpFaqSvg from "@/assets/icons/HelpAndSupport/FAQ.svg";
import helpTandCSvg from "@/assets/icons/HelpAndSupport/TandC.svg";
import helpPrivacyAndPoliciesSvg from "@/assets/icons/HelpAndSupport/PrivacyAndPolicies.svg";
import helpMedicalRecordsSvg from "@/assets/icons/HelpAndSupport/MedicalRecords.svg";
import helpLabReportsSvg from "@/assets/icons/HelpAndSupport/LabReports.svg";
import helpMyPrescriptionsSvg from "@/assets/icons/HelpAndSupport/MyPrescriptions.svg";
import helpActivitiesSvg from "@/assets/icons/HelpAndSupport/Activities.svg";

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
  /** Asset from `src/assets/icons/Services/` — used instead of `Icon` when set */
  iconSrc?: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
}>;

export const HUB_TABS: readonly HubTab[] = [
  { id: "services", label: "Services", iconSrc: viewServicesSvg },
  { id: "opd-claims", label: "OPD Claims", iconSrc: opdClaimsMainMenuSvg },
  { id: "account", label: "Account Management", iconSrc: accountMainMenuSvg },
  { id: "help", label: "Help & Support", iconSrc: helpMainMenuSvg },
  {
    id: "medical-records",
    label: "medical Records",
    iconSrc: helpMedicalRecordsSvg,
  },
];

export type HubCardItem = Readonly<{
  id: string;
  title: string;
  description: string;
  /** `src/assets/icons/Services/*.svg` for Services category tiles */
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
    id: "gym",
    title: "Gym & Fitness",
    description: "Buy Gym memberships and fitness membership",
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
    id: "password",
    title: "Set Password",
    description: "Manage your passwords",
    iconSrc: accountSetPasswordSvg,
  },
  {
    id: "delete",
    title: "Delete Account",
    description: "Delete your and family accounts",
    iconSrc: accountDeleteAccountSvg,
  },
  {
    id: "invoices",
    title: "Invoices",
    description: "Check your all invoices here",
    iconSrc: accountInvoicesSvg,
  },
];

export const HELP_ITEMS: readonly HubCardItem[] = [
  {
    id: "support",
    title: "Support",
    description: "For any queries or support tickets",
    iconSrc: helpSupportSvg,
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
    iconSrc: helpMedicalRecordsSvg,
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
