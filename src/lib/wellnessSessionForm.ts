import type { MemberDisplay } from "@/api/patientMember";

/** patient-app `MentalWellnessController.availableLanguages`. */
export const WELLNESS_LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Telugu",
  "Tamil",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
] as const;

export function normalizeWellnessPhone10(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

export function isValidWellnessEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function memberSummaryLine(member: MemberDisplay | null, fallbackName: string): string {
  if (!member) return fallbackName.trim() || "—";
  const rel = (member.relationship ?? "").trim();
  const lower = rel.toLowerCase();
  if (rel && lower !== "self" && lower !== "employee") {
    return `${member.name.trim()} (${rel})`;
  }
  return member.name.trim() || fallbackName.trim() || "—";
}

export type WellnessFormSnapshot = Readonly<{
  wellnessKind: "mental-wellness" | "nutrition";
  selectedMemberId: string;
  memberSummaryLine: string;
  name: string;
  phone: string;
  email: string;
  serviceArea: string;
  language: string;
  patientId: string | number;
  service: string;
}>;

export function validateWellnessForm(
  snap: WellnessFormSnapshot,
  opts: Readonly<{ categoriesLoaded: boolean }>,
): string | null {
  if (!snap.selectedMemberId.trim()) return "Please select a family member";
  if (!snap.name.trim()) return "Please enter your name";
  if (normalizeWellnessPhone10(snap.phone).length !== 10) {
    return "Please enter a valid 10-digit mobile number";
  }
  if (!isValidWellnessEmail(snap.email)) return "Please enter a valid email address";
  if (!snap.language.trim()) return "Please select a language";
  if (snap.wellnessKind === "mental-wellness") {
    if (!snap.serviceArea.trim()) return "Please select a consultation category";
    if (!opts.categoriesLoaded) {
      return "Please try again after categories load, or open the screen again.";
    }
  }
  return null;
}
