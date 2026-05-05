/**
 * Wallet module visibility for `/wallet/:subscriptionId`, aligned with patient_app
 * {@code SubscriptionHelper} + Opd {@code plan.modules} / wallet.module keys.
 */

import { extractProfileRecord } from "@/lib/subscriptionDashboardModules";
import type { WalletModuleDisplay, WalletRefTypeApi } from "@/api/wallet";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function coerceBool(v: unknown): boolean {
  if (v === true || v === "true" || v === 1) return true;
  if (v === false || v === "false" || v === 0) return false;
  return false;
}

function pickModule(
  modules: Record<string, unknown>,
  canonical: string,
): Record<string, unknown> | null {
  const lower = canonical.toLowerCase();
  for (const k of Object.keys(modules)) {
    if (k.toLowerCase() === lower) {
      return asRecord(modules[k]);
    }
  }
  return null;
}

/** Same idea as Flutter {@code SubscriptionHelper.hideModule} for one plan row. */
export function subscriptionHideSubType(
  mod: Record<string, unknown> | null,
  type: string,
): boolean {
  if (!mod || !Object.prototype.hasOwnProperty.call(mod, "hideModulesInApp")) {
    return false;
  }
  if (mod.hideModulesInApp !== true) return false;
  const raw = mod.modulesToHide ?? mod.modules_to_hide;
  const list = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  return list.includes(type);
}

const MODULE_NAME_TO_CATEGORY: Readonly<Record<string, string>> = {
  Consultation: "consultation",
  Lab: "lab",
  Pharmacy: "pharmacy",
  Dental: "dental",
  Vision: "vision",
  Vaccine: "vaccine",
  Gym: "gym",
  Fitness: "fitness",
  Nutritionist: "nutrition",
  Mentalwellness: "mental_wellness",
  MentalWellness: "mental_wellness",
  Chronicmanagement: "nutrition",
};

const ALL_BREAKUP_CATEGORIES = new Set([
  "consultation",
  "lab",
  "pharmacy",
  "dental",
  "vision",
  "vaccine",
  "nutrition",
  "gym",
  "fitness",
  "yoga",
  "mental_wellness",
]);

function findSubscriptionRow(
  profile: Record<string, unknown>,
  subscriptionId: string,
): Record<string, unknown> | null {
  const want = subscriptionId.trim();
  if (!want) return null;
  const subs = profile.subscription ?? profile.subscriptions;
  if (!Array.isArray(subs)) return null;
  for (const s of subs) {
    const row = asRecord(s);
    if (!row) continue;
    const id = row.id ?? row.subscription_id ?? row.subscriptionId;
    if (id != null && String(id).trim() === want) return row;
  }
  return null;
}

function mergeOpdWalletHides(
  opd: Record<string, unknown>,
  hidden: Set<string>,
): void {
  if (opd.hideModulesInApp === true) {
    const raw = opd.modulesToHide ?? opd.modules_to_hide;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item !== "string") continue;
        const k = normalizeOpdHideToken(item);
        if (k) hidden.add(k);
      }
    }
  }

  const inner = asRecord(opd.modules);
  if (!inner) return;
  for (const [opdKey, val] of Object.entries(inner)) {
    const o = asRecord(val);
    if (!o) continue;
    if (o.hideModulesInApp !== true) continue;
    const subRaw = o.modulesToHide ?? o.modules_to_hide;
    const list = Array.isArray(subRaw) ? subRaw.map((x) => String(x)) : [];
    const cat = opdInnerKeyToCategoryKey(opdKey);
    if (!cat) continue;
    if (list.length === 0) {
      hidden.add(cat);
    } else {
      for (const item of list) {
        const k = normalizeOpdHideToken(item);
        if (k) hidden.add(k);
      }
    }
  }
}

function opdInnerKeyToCategoryKey(key: string): string | null {
  const k = key.trim().toLowerCase();
  const map: Record<string, string> = {
    lab: "lab",
    consultation: "consultation",
    pharmacy: "pharmacy",
    dental: "dental",
    vision: "vision",
    vaccine: "vaccine",
    nutrition: "nutrition",
    gym: "gym",
    fitness: "fitness",
    yoga: "yoga",
  };
  return map[k] ?? null;
}

function normalizeOpdHideToken(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("consult")) return "consultation";
  if (s.includes("lab") || s === "test" || s === "package") return "lab";
  if (s.includes("pharma")) return "pharmacy";
  if (s.includes("dental")) return "dental";
  if (s.includes("vision")) return "vision";
  if (s.includes("vaccin")) return "vaccine";
  if (s.includes("nutrition")) return "nutrition";
  if (s === "yoga") return "yoga";
  if (s.includes("gym")) return "gym";
  if (s.includes("fitness")) return "fitness";
  if (s.includes("mental")) return "mental_wellness";
  return opdInnerKeyToCategoryKey(s);
}

/**
 * Category keys ({@link WalletModuleDisplay.categoryKey}) hidden for this subscription
 * when corporate rules apply; empty set when not subscribed (retail) or no match.
 */
export function computeHiddenWalletCategoryKeys(
  profileBody: unknown,
  subscriptionId: string,
): Set<string> {
  const hidden = new Set<string>();
  const profile = extractProfileRecord(profileBody);
  if (!profile) return hidden;

  const subsList = profile.subscription ?? profile.subscriptions;
  const subOk =
    coerceBool(profile.isSubscribed ?? profile.is_subscribed) &&
    Array.isArray(subsList) &&
    subsList.length > 0;

  if (!subOk) return hidden;

  const row = findSubscriptionRow(profile, subscriptionId);
  if (!row) return hidden;

  const plan = asRecord(row.plan);
  const modules = asRecord(plan?.modules);
  if (!modules) return hidden;

  for (const [moduleName, categoryKey] of Object.entries(MODULE_NAME_TO_CATEGORY)) {
    const mod = pickModule(modules, moduleName);
    if (mod && Object.prototype.hasOwnProperty.call(mod, "active") && mod.active === false) {
      hidden.add(categoryKey);
      if (moduleName === "Fitness") hidden.add("yoga");
    }
  }

  const lab = pickModule(modules, "Lab");
  if (lab) {
    const hp = subscriptionHideSubType(lab, "package");
    const ht = subscriptionHideSubType(lab, "test");
    if (hp && ht) hidden.add("lab");
  }

  const consultation = pickModule(modules, "Consultation");
  if (consultation) {
    const ho = subscriptionHideSubType(consultation, "opd_consultation");
    const ht = subscriptionHideSubType(consultation, "tele_consultation");
    if (ho && ht) hidden.add("consultation");
  }

  const vision = pickModule(modules, "Vision");
  if (vision) {
    const hc = subscriptionHideSubType(vision, "clinic");
    const hs = subscriptionHideSubType(vision, "store");
    if (hc && hs) hidden.add("vision");
  }

  const fitness = pickModule(modules, "Fitness");
  if (fitness) {
    const hf = subscriptionHideSubType(fitness, "fitness");
    const hy = subscriptionHideSubType(fitness, "yoga");
    if (hf) hidden.add("fitness");
    if (hy) hidden.add("yoga");
  }

  const opd = pickModule(modules, "Opd");
  if (opd) {
    if (opd.active === false) {
      for (const k of ALL_BREAKUP_CATEGORIES) hidden.add(k);
    } else {
      mergeOpdWalletHides(opd, hidden);
    }
  }

  return hidden;
}

/** Flutter wallet_screen: only modules with total limit &gt; 0; plus subscription hides. */
export function filterWalletModulesForSubscription(
  modules: readonly WalletModuleDisplay[],
  hiddenCategoryKeys: ReadonlySet<string>,
): WalletModuleDisplay[] {
  return modules.filter((m) => {
    const cap = m.limit ?? 0;
    if (cap <= 0) return false;
    return !hiddenCategoryKeys.has(m.categoryKey);
  });
}

const CATEGORY_TO_REF_TYPE: Readonly<Partial<Record<string, WalletRefTypeApi>>> = {
  consultation: "Consultation",
  lab: "Labtest",
  pharmacy: "Pharmacy",
  dental: "Dental",
  vision: "Vision",
  vaccine: "Vaccine",
  nutrition: "Nutrition",
  fitness: "Fitness",
  yoga: "Yoga",
  gym: "Fitness",
  mental_wellness: "MentalWellnesss",
};

/** Ref-type filters to remove from the all-transactions sheet when that module is hidden. */
export function hiddenWalletRefTypesForCategories(
  hiddenCategoryKeys: ReadonlySet<string>,
): ReadonlySet<WalletRefTypeApi> {
  const out = new Set<WalletRefTypeApi>();
  for (const key of hiddenCategoryKeys) {
    const api = CATEGORY_TO_REF_TYPE[key];
    if (api) out.add(api);
  }
  return out;
}
