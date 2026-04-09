import type { BmiCategory } from "@/api/patientProfile";

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "?";
}

export function formatGender(g: string | null): string | null {
  if (!g) return null;
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

export function parseAgeYears(ageStr: string | null): number | null {
  if (ageStr == null || ageStr === "") return null;
  const n = Math.trunc(Number(ageStr.trim()));
  if (Number.isNaN(n) || n < 0 || n >= 150) return null;
  return n;
}

export function ageFromDob(dob: string | null): number | null {
  if (dob == null || dob.trim() === "") return null;
  const d = new Date(dob.trim());
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    years -= 1;
  }
  if (years < 0 || years >= 130) return null;
  return years;
}

/** e.g. `1994-04-09 (31 Years Old)` */
export function formatDobAgeGenderLine(
  dob: string | null,
  _age: string | null,
): string | null {
  const dobTrim = dob?.trim() ?? "";

  let line = dobTrim;

  return line.length > 0 ? line : null;
}

export function formatLabel(s: string | null): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function bmiToneClass(category: BmiCategory | null): string {
  return category
    ? `profile-page__bmi-pill--${category}`
    : "profile-page__bmi-pill--neutral";
}
