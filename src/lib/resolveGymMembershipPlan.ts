import type { GymCheckData } from "@/api/patientGym";
import { GYM_MEMBERSHIP_PLANS, type GymMembershipPlan } from "@/constants/gymPlans";
import { gymPackageToMembershipPlan } from "@/lib/gymPackageToPlan";

export function resolveGymMembershipPlan(
  planId: string | null,
  check: GymCheckData | null,
): GymMembershipPlan | null {
  if (!planId) return null;
  const staticPlan = GYM_MEMBERSHIP_PLANS.find((p) => p.id === planId);
  if (staticPlan) return staticPlan;
  if (!check?.packages.length) return null;
  const idx = check.packages.findIndex((p) => p.package_code === planId);
  if (idx < 0) return null;
  return gymPackageToMembershipPlan(check.packages[idx], idx);
}

/** `dependents: ["employee"]` → single-member (no secondary) flow. */
export function gymCheckAllowsSecondaryMember(check: GymCheckData | null): boolean {
  if (!check?.dependents.length) return true;
  return !(check.dependents.length === 1 && check.dependents[0] === "employee");
}
