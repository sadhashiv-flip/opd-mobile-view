/**
 * Dashboard / services module tiles & bottom sheets from profile `plan.modules`
 * (patient_app {@code SubscriptionHelper} parity — first matching subscription plan).
 */

import {
  extractProfileRecord,
  parseSubscriptionDashboardModules,
  type SubscriptionDashboardModules,
} from "@/lib/subscriptionDashboardModules";
import { subscriptionHideSubType } from "@/lib/walletSubscriptionModules";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function coerceBool(v: unknown): boolean {
  if (v === true || v === "true" || v === "1" || v === 1) return true;
  if (v === false || v === "false" || v === "0" || v === 0) return false;
  return false;
}

export function pickPlanModule(
  modules: Record<string, unknown>,
  canonical: string,
): Record<string, unknown> | null {
  const lower = canonical.toLowerCase();
  for (const k of Object.keys(modules)) {
    if (k.toLowerCase() === lower) return asRecord(modules[k]);
  }
  return null;
}

/** Any subscription row has `plan.modules[key].active === true`. */
export function hasModuleActive(profile: Record<string, unknown>, moduleKey: string): boolean {
  const subs = profile.subscription ?? profile.subscriptions;
  if (!Array.isArray(subs)) return false;
  for (const s of subs) {
    const plan = asRecord(asRecord(s)?.plan);
    const modules = asRecord(plan?.modules);
    if (!modules) continue;
    const m = pickPlanModule(modules, moduleKey);
    if (m && coerceBool(m.active)) return true;
  }
  return false;
}

function subscriptionGateOk(profile: Record<string, unknown>): boolean {
  const subs = profile.subscription ?? profile.subscriptions;
  return coerceBool(profile.isSubscribed ?? profile.is_subscribed) && Array.isArray(subs) && subs.length > 0;
}

export type ConsultationGate = Readonly<{
  showTile: boolean;
  sheetHospital: boolean;
  sheetVirtual: boolean;
}>;

/**
 * When subscription exposes exactly one consultation mode, skip the picker sheet (parity with
 * {@link diagnosticsSingleVisibleSlug} on Home / Services hub).
 */
export function consultationSingleVisibleType(
  gate: ConsultationGate,
): "virtual" | "at_hospital" | null {
  if (gate.sheetHospital && !gate.sheetVirtual) return "at_hospital";
  if (!gate.sheetHospital && gate.sheetVirtual) return "virtual";
  return null;
}

/** Flutter {@code consultationEntryUnblocked} + sheet rows. */
export function parseConsultationGate(profileBody: unknown): ConsultationGate {
  const open: ConsultationGate = {
    showTile: true,
    sheetHospital: true,
    sheetVirtual: true,
  };
  const profile = extractProfileRecord(profileBody);
  if (!profile) return open;
  if (!subscriptionGateOk(profile)) return open;

  const subs = profile.subscription ?? profile.subscriptions;
  if (!Array.isArray(subs) || subs.length === 0) return open;

  let consultMod: Record<string, unknown> | null = null;
  for (const s of subs) {
    const plan = asRecord(asRecord(s)?.plan);
    const modules = asRecord(plan?.modules);
    if (!modules) continue;
    const c = pickPlanModule(modules, "Consultation");
    if (c) {
      consultMod = c;
      break;
    }
  }

  if (!consultMod || !coerceBool(consultMod.active)) {
    return { showTile: false, sheetHospital: false, sheetVirtual: false };
  }

  const ho = subscriptionHideSubType(consultMod, "opd_consultation");
  const ht = subscriptionHideSubType(consultMod, "tele_consultation");
  const showTile = !(ho && ht);

  return {
    showTile,
    sheetHospital: !ho,
    sheetVirtual: !ht,
  };
}

export type VisionGate = Readonly<{
  showTile: boolean;
  sheetClinic: boolean;
  sheetStore: boolean;
}>;

export function parseVisionGate(profileBody: unknown): VisionGate {
  const open: VisionGate = { showTile: true, sheetClinic: true, sheetStore: true };
  const profile = extractProfileRecord(profileBody);
  if (!profile) return open;
  if (!subscriptionGateOk(profile)) return open;

  const subs = profile.subscription ?? profile.subscriptions;
  if (!Array.isArray(subs)) return open;

  let visionMod: Record<string, unknown> | null = null;
  for (const s of subs) {
    const plan = asRecord(asRecord(s)?.plan);
    const modules = asRecord(plan?.modules);
    if (!modules) continue;
    const v = pickPlanModule(modules, "Vision");
    if (v) {
      visionMod = v;
      break;
    }
  }

  if (!visionMod || !coerceBool(visionMod.active)) {
    return { showTile: false, sheetClinic: false, sheetStore: false };
  }

  const hc = subscriptionHideSubType(visionMod, "clinic");
  const hs = subscriptionHideSubType(visionMod, "store");

  return {
    showTile: !(hc && hs),
    sheetClinic: !hc,
    sheetStore: !hs,
  };
}

/** Services hub “services” tab — tile visibility when corporate subscription applies. */
export type ServiceHubTileGates = Readonly<{
  diag: boolean;
  consult: boolean;
  dental: boolean;
  pharm: boolean;
  vax: boolean;
  vision: boolean;
  /** `plan.modules.Gym` — gym membership purchase flow */
  gym: boolean;
  /** `plan.modules.Fitness` — classes / health club (separate from Gym) */
  fitness: boolean;
  mental: boolean;
  nutrition: boolean;
  chronic: boolean;
  /** OPD reimbursement — `plan.modules.Claim.active` (patient_app {@code hasClaimModule}). */
  claim: boolean;
}>;

const ALL_OPEN: ServiceHubTileGates = {
  diag: false,
  consult: false,
  dental: false,
  pharm: false,
  vax: false,
  vision: false,
  gym: false,
  fitness: false,
  mental: false,
  nutrition: false,
  chronic: false,
  claim: false,
};

export function parseServiceHubTileGates(profileBody: unknown): ServiceHubTileGates {
  const profile = extractProfileRecord(profileBody);
  if (!profile || !subscriptionGateOk(profile)) return ALL_OPEN;

  const cg = parseConsultationGate(profileBody);
  const vg = parseVisionGate(profileBody);

  return {
    diag: hasModuleActive(profile, "Lab") || hasModuleActive(profile, "Diagnostic"),
    consult: cg.showTile,
    dental: hasModuleActive(profile, "Dental"),
    pharm: hasModuleActive(profile, "Pharmacy"),
    vax: hasModuleActive(profile, "Vaccine"),
    vision: vg.showTile,
    gym: hasModuleActive(profile, "Gym"),
    fitness: hasModuleActive(profile, "Fitness"),
    mental: hasModuleActive(profile, "Mentalwellness"),
    nutrition: hasModuleActive(profile, "Nutritionist"),
    chronic: hasModuleActive(profile, "Chronicmanagement"),
    claim: hasModuleActive(profile, "Claim"),
  };
}

/**
 * Services hub top tab “OPD Claims” — `plan.modules.Claim.active` (patient-webapp parity).
 * Retail / no subscription: show tab. Corporate: show only when Claim exists, is active, and not
 * `hideModulesInApp` for the whole module.
 */
export function parseShowOpdClaimsHubTab(profileBody: unknown): boolean {
  const profile = extractProfileRecord(profileBody);
  if (!profile) return true;
  if (!subscriptionGateOk(profile)) return false;

  const subs = profile.subscription ?? profile.subscriptions;
  if (!Array.isArray(subs)) return true;

  for (const s of subs) {
    const plan = asRecord(asRecord(s)?.plan);
    const modules = asRecord(plan?.modules);
    if (!modules) continue;
    const claim = pickPlanModule(modules, "Claim");
    if (!claim) continue;
    if (!coerceBool(claim.active)) return false;
    if (claim.hideModulesInApp === true) return false;
    return true;
  }

  return false;
}

/** From `profile.subscription[0].plan.dependent_add` / `dependent_edit` (snake or camel). */
export type PlanDependentGate = Readonly<{
  dependentAddAllowed: boolean;
  dependentEditAllowed: boolean;
}>;

const PLAN_DEPENDENTS_OPEN: PlanDependentGate = {
  dependentAddAllowed: false,
  dependentEditAllowed: false,
};

/**
 * First subscription row's plan controls whether users may add or edit dependents in the app.
 * Default is restrictive: only explicit true in subscription plan enables these actions.
 */
export function parsePlanDependentFlags(profileBody: unknown): PlanDependentGate {
  const profile = extractProfileRecord(profileBody);
  if (!profile) return PLAN_DEPENDENTS_OPEN;
  const subs = profile.subscription ?? profile.subscriptions;
  if (!Array.isArray(subs) || subs.length === 0) return PLAN_DEPENDENTS_OPEN;
  const plan = asRecord(asRecord(subs[0])?.plan);
  if (!plan) return PLAN_DEPENDENTS_OPEN;

  const addRaw = plan.dependent_add ?? plan.dependentAdd;
  const editRaw = plan.dependent_edit ?? plan.dependentEdit;

  return {
    dependentAddAllowed: addRaw === undefined ? false : coerceBool(addRaw),
    dependentEditAllowed: editRaw === undefined ? false : coerceBool(editRaw),
  };
}

export type ProfileModuleGates = SubscriptionDashboardModules &
  Readonly<{
    consultation: ConsultationGate;
    vision: VisionGate;
    serviceHub: ServiceHubTileGates;
    showOpdClaimsHubTab: boolean;
    planDependents: PlanDependentGate;
  }>;

export function parseProfileModuleGates(profileBody: unknown): ProfileModuleGates {
  const sub = parseSubscriptionDashboardModules(profileBody);
  return {
    ...sub,
    consultation: parseConsultationGate(profileBody),
    vision: parseVisionGate(profileBody),
    serviceHub: parseServiceHubTileGates(profileBody),
    showOpdClaimsHubTab: parseShowOpdClaimsHubTab(profileBody),
    planDependents: parsePlanDependentFlags(profileBody),
  };
}
