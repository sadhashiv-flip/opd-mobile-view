import {
  GYM_AGE_BLOCK_REASON,
  isGymMemberAgeBlocked,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";
import type {
  GymDependentPackage,
  GymEligibilityData,
  GymEmployeePackage,
  GymLocationPricing,
  GymOptInLinePayload,
  GymSubscriptionRow,
} from "@/api/patientGymSubscription";

export type GymLineFormModel = Readonly<{
  packageCode: string;
  isEmployeePackage: boolean;
  packageDisplayName: string;
  memberId: number;
  memberDisplayName: string;
  locationKey: string;
  name: string;
  phone: string;
  email: string;
  personalEmail: string;
  locationOptions: readonly string[];
}>;

export function parseMemberId(row: GymMemberListRow): number {
  if (row.userId != null && row.userId > 0) return row.userId;
  const n = Number.parseInt(String(row.id).trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export function employeeMemberRow(rows: readonly GymMemberListRow[]): GymMemberListRow | null {
  if (!rows.length) return null;
  for (const m of rows) {
    if (m.section === "self") return m;
  }
  return rows[0] ?? null;
}

export function dependentCandidates(
  rows: readonly GymMemberListRow[],
  employee: GymMemberListRow | null,
): GymMemberListRow[] {
  const eid = employee?.id;
  return rows.filter((m) => m.id !== eid);
}

export function memberCanBuyGym(eligibility: GymEligibilityData | null, memberId: number): boolean {
  if (memberId === 0) return false;
  if (!eligibility || !eligibility.gymModuleActive) return false;
  for (const m of eligibility.members) {
    if (m.memberId === memberId) return m.canBuy;
  }
  return true;
}

export function memberGymEligibilityBlockMessage(
  eligibility: GymEligibilityData | null,
  memberId: number,
): string | null {
  if (!eligibility) return null;
  if (!eligibility.gymModuleActive) {
    return "Gym membership is not available for this subscription.";
  }
  for (const m of eligibility.members) {
    if (m.memberId === memberId && !m.canBuy) {
      if (m.message.trim()) return m.message.trim();
      if (m.reason.trim()) return m.reason.replaceAll("_", " ");
      return "Not eligible to purchase this gym package.";
    }
  }
  return null;
}

export type GymDependentPickerRowUi = Readonly<{
  cannotSelect: boolean;
  subtitle: string | null;
  subtitleVariant: "error" | "warning" | "muted";
  showActivate: boolean;
}>;

/**
 * patient_app `GymMembershipScreen._openDependentSelector` — row enablement and subtitle priority.
 */
export function gymDependentPickerRowUi(args: {
  readonly member: GymMemberListRow;
  readonly packageCode: string;
  readonly checked: boolean;
  readonly eligibility: GymEligibilityData | null;
  readonly isDependentSelectedInOtherPackage: (packageCode: string, memberId: string) => boolean;
}): GymDependentPickerRowUi {
  const mid = parseMemberId(args.member);
  const otherBlocked =
    args.isDependentSelectedInOtherPackage(args.packageCode, args.member.id) && !args.checked;
  const ineligible = !memberCanBuyGym(args.eligibility, mid) && !args.checked;
  const notActivated = !args.member.isSubscribed;
  const ageBlocked = isGymMemberAgeBlocked(args.member.age);
  /** Not activated is surfaced in the sheet (Activate CTA) — do not disable the row for that alone. */
  const cannotSelect = otherBlocked || ineligible || ageBlocked;
  const showActivate = notActivated && args.member.subscriptionCanActivate;

  if (notActivated) {
    return {
      cannotSelect,
      subtitle: "Not activated",
      subtitleVariant: "error",
      showActivate,
    };
  }
  if (ageBlocked) {
    return {
      cannotSelect,
      subtitle: GYM_AGE_BLOCK_REASON,
      subtitleVariant: "muted",
      showActivate: false,
    };
  }
  if (otherBlocked) {
    return {
      cannotSelect,
      subtitle: "Already selected in another package",
      subtitleVariant: "warning",
      showActivate: false,
    };
  }
  if (ineligible) {
    return {
      cannotSelect,
      subtitle: memberGymEligibilityBlockMessage(args.eligibility, mid) ?? "Not eligible",
      subtitleVariant: "muted",
      showActivate: false,
    };
  }
  return { cannotSelect, subtitle: null, subtitleVariant: "muted", showActivate: false };
}

export function gymDependentMemberEligibleForApply(
  eligibility: GymEligibilityData | null,
  row: GymMemberListRow,
): boolean {
  const mid = parseMemberId(row);
  if (mid === 0) return false;
  if (!memberCanBuyGym(eligibility, mid)) return false;
  if (!row.isSubscribed) return false;
  if (isGymMemberAgeBlocked(row.age)) return false;
  return true;
}

export function allPricingLocationKeys(sub: GymSubscriptionRow): string[] {
  const keys = new Set<string>();
  for (const p of sub.dependentPackages) {
    for (const pr of p.pricing) {
      if (pr.locationKey.trim()) keys.add(pr.locationKey);
    }
  }
  if (keys.size === 0) return ["hyderabad"];
  return [...keys].sort();
}

export function locationOptionsForEmployeeLine(sub: GymSubscriptionRow): string[] {
  if (sub.serviceableLocations.length > 0) {
    return [...sub.serviceableLocations];
  }
  return allPricingLocationKeys(sub);
}

export function locationOptionsForDependentPackage(
  sub: GymSubscriptionRow,
  packageCode: string,
): string[] {
  let pkg: GymDependentPackage | undefined;
  for (const p of sub.dependentPackages) {
    if (p.packageCode === packageCode) {
      pkg = p;
      break;
    }
  }
  if (!pkg || pkg.pricing.length === 0) {
    return allPricingLocationKeys(sub);
  }
  return pkg.pricing.map((p) => p.locationKey).filter((k) => k.trim().length > 0);
}

export function pricingForDependent(
  sub: GymSubscriptionRow,
  packageCode: string,
  locationKey: string,
): GymLocationPricing | null {
  let pkg: GymDependentPackage | undefined;
  for (const p of sub.dependentPackages) {
    if (p.packageCode === packageCode) {
      pkg = p;
      break;
    }
  }
  if (!pkg) return null;
  for (const e of pkg.pricing) {
    if (e.locationKey === locationKey) return e;
  }
  return null;
}

export function eligibilityMatchesSubscription(
  eligibility: GymEligibilityData | null,
  subscriptionId: string,
): boolean {
  return eligibility != null && eligibility.subscriptionId === subscriptionId;
}

export function canProceedFromSelections(
  eligibility: GymEligibilityData | null,
  eligibilityLoading: boolean,
  eligibilityFetchFailed: boolean,
  activeSubscription: GymSubscriptionRow | null,
  selectedEmployeeCodes: readonly string[],
  selectedDependentCodes: readonly string[],
  dependentMemberIdsByPackage: Readonly<Record<string, readonly string[]>>,
  familyRows: readonly GymMemberListRow[],
): boolean {
  if (!activeSubscription) return false;
  if (selectedEmployeeCodes.length === 0 && selectedDependentCodes.length === 0) return false;
  if (eligibilityLoading) return false;
  if (eligibilityFetchFailed) return false;
  if (!eligibility || !eligibility.gymModuleActive) return false;
  if (!eligibilityMatchesSubscription(eligibility, activeSubscription.subscriptionId)) return false;

  const emp = employeeMemberRow(familyRows);
  const empMid = emp ? parseMemberId(emp) : 0;

  if (selectedEmployeeCodes.length > 0) {
    if (!emp || empMid === 0) return false;
    if (!memberCanBuyGym(eligibility, empMid)) return false;
  }

  for (const code of selectedDependentCodes) {
    const picked = dependentMemberIdsByPackage[code] ?? [];
    if (picked.length === 0) return false;
    for (const id of picked) {
      const row = familyRows.find((r) => r.id === id);
      if (!row || !gymDependentMemberEligibleForApply(eligibility, row)) return false;
    }
  }

  return true;
}

function isPhoneValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10;
}

function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isLineValid(f: GymLineFormModel): boolean {
  if (!f.locationKey.trim()) return false;
  if (!f.name.trim()) return false;
  if (!isPhoneValid(f.phone)) return false;
  const email = f.email.trim();
  if (f.isEmployeePackage) {
    if (!email || !isEmailValid(email)) return false;
  } else if (email && !isEmailValid(email)) {
    return false;
  }
  return true;
}

export function lineValidationMessage(f: GymLineFormModel): string {
  if (!f.locationKey.trim()) return "Select location";
  if (!f.name.trim()) return "Enter full name";
  if (!isPhoneValid(f.phone)) return "Enter valid phone";
  const email = f.email.trim();
  if (f.isEmployeePackage) {
    if (!email) return "Email is required for employee";
    if (!isEmailValid(email)) return "Enter valid email";
  } else if (email && !isEmailValid(email)) {
    return "Enter valid email or keep it empty";
  }
  return "Looks good";
}

export function buildLineForms(
  sub: GymSubscriptionRow,
  familyRows: readonly GymMemberListRow[],
  selectedEmployeeCodes: readonly string[],
  selectedDependentCodes: readonly string[],
  dependentMemberIdsByPackage: Readonly<Record<string, readonly string[]>>,
): GymLineFormModel[] {
  const emp = employeeMemberRow(familyRows);
  const next: GymLineFormModel[] = [];

  for (const code of selectedEmployeeCodes) {
    let pkg: GymEmployeePackage | undefined;
    for (const p of sub.employeePackages) {
      if (p.packageCode === code) {
        pkg = p;
        break;
      }
    }
    if (!pkg || !emp) continue;
    const mid = parseMemberId(emp);
    next.push({
      packageCode: pkg.packageCode,
      isEmployeePackage: true,
      packageDisplayName: pkg.packageName,
      memberId: mid,
      memberDisplayName: emp.name,
      locationKey: "",
      name: emp.name,
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      personalEmail: "",
      locationOptions: locationOptionsForEmployeeLine(sub),
    });
  }

  for (const code of selectedDependentCodes) {
    let pkg: GymDependentPackage | undefined;
    for (const p of sub.dependentPackages) {
      if (p.packageCode === code) {
        pkg = p;
        break;
      }
    }
    if (!pkg) continue;
    const ids = dependentMemberIdsByPackage[code] ?? [];
    for (const id of ids) {
      const m = familyRows.find((r) => r.id === id);
      if (!m) continue;
      const mid = parseMemberId(m);
      next.push({
        packageCode: pkg.packageCode,
        isEmployeePackage: false,
        packageDisplayName: pkg.packageName,
        memberId: mid,
        memberDisplayName: m.name,
        locationKey: "",
        name: m.name,
        phone: m.phone ?? "",
        email: m.email ?? "",
        personalEmail: "",
        locationOptions: locationOptionsForDependentPackage(sub, code),
      });
    }
  }

  return next;
}

export function lineFormsToQuoteLines(forms: readonly GymLineFormModel[]): readonly {
  member_id: number;
  package_code: string;
  location: string;
}[] {
  return forms.map((f) => ({
    member_id: f.memberId,
    package_code: f.packageCode,
    location: f.locationKey.trim(),
  }));
}

export function lineFormsToOptInLines(forms: readonly GymLineFormModel[]): readonly GymOptInLinePayload[] {
  return forms.map((f) => {
    const email = f.email.trim();
    return {
      member_id: f.memberId,
      package_code: f.packageCode,
      location: f.locationKey.trim(),
      name: f.name.trim(),
      phone: f.phone.trim(),
      ...(f.isEmployeePackage || email.length > 0 ? { email } : {}),
      personal_email: f.personalEmail.trim() || "N/A",
    };
  });
}
