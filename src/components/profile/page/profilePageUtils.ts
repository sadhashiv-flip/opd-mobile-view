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

/** e.g. `02-02-1979` */
export function formatProfileDob(dob: string | null): string | null {
  const dobTrim = dob?.trim() ?? "";
  if (!dobTrim) return null;

  const iso = /^\d{4}-\d{2}-\d{2}/.exec(dobTrim);
  if (iso) {
    const d = new Date(dobTrim);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  }

  return dobTrim;
}

/** e.g. `1994-04-09 (31 Years Old)` */
export function formatDobAgeGenderLine(
  dob: string | null,
  _age: string | null,
): string | null {
  return formatProfileDob(dob);
}

/** Display phone with spacing when possible. */
export function formatProfilePhone(phone: string | null): string | null {
  const raw = phone?.trim() ?? "";
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return raw;
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
