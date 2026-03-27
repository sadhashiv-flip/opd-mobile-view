import type { ComponentType, SVGProps } from "react";
import * as I from "@/components/services/serviceHubIcons";
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
  { id: "opd-claims", label: "OPD Claims", Icon: I.IconTabOpd },
  { id: "account", label: "Account Management", Icon: I.IconTabAccount },
  { id: "help", label: "Help & Support", Icon: I.IconTabHelp },
  {
    id: "medical-records",
    label: "medical Records",
    Icon: I.IconTabRecords,
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
    Icon: I.IconDocShield,
  },
  {
    id: "bank",
    title: "Bank Details",
    description: "Add/edit bank details",
    Icon: I.IconBank,
  },
];

export const ACCOUNT_ITEMS: readonly HubCardItem[] = [
  {
    id: "profile",
    title: "Profile",
    description: "Manage profile details",
    Icon: I.IconProfile,
  },
  {
    id: "subs",
    title: "Subscriptions",
    description: "Manage subscriptions",
    Icon: I.IconJarPlus,
  },
  {
    id: "family",
    title: "Family Accounts",
    description: "Manage family members",
    Icon: I.IconFamily,
  },
  {
    id: "address",
    title: "Address Book",
    description: "Manage address details",
    Icon: I.IconAddressBook,
  },
  {
    id: "orders",
    title: "Orders",
    description: "Check order status",
    Icon: I.IconCart,
  },
  {
    id: "password",
    title: "Set Password",
    description: "Manage your passwords",
    Icon: I.IconLock,
  },
  {
    id: "delete",
    title: "Delete Account",
    description: "Delete your and family accounts",
    Icon: I.IconTrash,
  },
  {
    id: "invoices",
    title: "Invoices",
    description: "Check your all invoices here",
    Icon: I.IconInvoice,
  },
];

export const HELP_ITEMS: readonly HubCardItem[] = [
  {
    id: "support",
    title: "Support",
    description: "For any queries or support tickets",
    Icon: I.IconHeadset,
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Refer FAQs here",
    Icon: I.IconFaq,
  },
  {
    id: "tc",
    title: "T&C",
    description: "Read all the Terms & Conditions here",
    Icon: I.IconTerms,
  },
  {
    id: "privacy",
    title: "Privacy Policies",
    description: "Refer all the privacy policies here",
    Icon: I.IconPrivacy,
  },
];

export const MEDICAL_RECORDS_ITEMS: readonly HubCardItem[] = [
  {
    id: "appts",
    title: "My Appointments",
    description: "Check your appointments history/status here",
    Icon: I.IconCalendarPerson,
  },
  {
    id: "lab",
    title: "Lab Reports",
    description: "Check your lab test reports here",
    Icon: I.IconLabClipboard,
  },
  {
    id: "rx",
    title: "My Prescriptions",
    description: "Check your prescriptions here",
    Icon: I.IconRx,
    badge: "new",
  },
  {
    id: "activity",
    title: "Activities",
    description: "Check your activities",
    Icon: I.IconActivity,
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
