/**
 * Dashboard visibility from `GET /patient/profile` subscription / `plan.modules`
 * (see sample `api_response.json`).
 */

export const DIAG_SUB_HEALTH_CHECKUPS = "health-checkups";
export const DIAG_SUB_LAB_TESTS = "lab-tests";

export type SubscriptionDashboardModules = Readonly<{
  /** `isSubscribed && subscription.length > 0` */
  gateOk: boolean;
  /** Diagnostics featured tile: gate + Lab.active + !Lab.hideModulesInApp */
  showLabDiagnosticsTile: boolean;
  /** AHC hero: gate + Lab + health-checkups sub not hidden */
  showAhcBanner: boolean;
  /** Sub-slugs hidden inside diagnostics sheet (health-checkups / lab-tests) */
  diagnosticsHiddenSubSlugs: ReadonlySet<string>;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Accepts `{ profile: {...} }` or flat profile payload. */
export function extractProfileRecord(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  if (!root) return null;

  const direct = asRecord(root.profile) ?? asRecord(root.data) ?? asRecord(root.user);
  if (direct) return direct;

  const nestedData = asRecord(root.data);
  if (nestedData) {
    return asRecord(nestedData.profile) ?? asRecord(nestedData.user) ?? root;
  }

  return root;
}

function coerceBool(v: unknown): boolean {
  if (v === true || v === "true" || v === "1" || v === 1) return true;
  if (v === false || v === "false" || v === "0" || v === 0) return false;
  return false;
}

/**
 * When subscription hides exactly one diagnostics branch, skip the picker bottom sheet and
 * navigate straight to the remaining route (Home + Services hub).
 */
export function diagnosticsSingleVisibleSlug(
  hiddenSubSlugs: ReadonlySet<string>,
): "health-checkups" | "lab-tests" | null {
  const hc = hiddenSubSlugs.has(DIAG_SUB_HEALTH_CHECKUPS);
  const lt = hiddenSubSlugs.has(DIAG_SUB_LAB_TESTS);
  if (!hc && !lt) return null;
  if (!hc && lt) return "health-checkups";
  if (hc && !lt) return "lab-tests";
  return null;
}

/** Normalize API hide tokens → route slug keys {@link DIAG_SUB_HEALTH_CHECKUPS} | {@link DIAG_SUB_LAB_TESTS}. */
export function normalizeDiagnosticsHideToken(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  /** Backend `modulesToHide` short tokens — health packages vs lab tests */
  if (s === "package" || s === "packages") return DIAG_SUB_HEALTH_CHECKUPS;
  if (s === "test" || s === "tests") return DIAG_SUB_LAB_TESTS;
  if (/health/.test(s) && /check/.test(s)) return DIAG_SUB_HEALTH_CHECKUPS;
  if (/lab/.test(s) && /test/.test(s)) return DIAG_SUB_LAB_TESTS;
  if (s === "health-checkups" || s === "health_checkups" || s === "healthcheckup") {
    return DIAG_SUB_HEALTH_CHECKUPS;
  }
  if (s === "lab-tests" || s === "lab_tests" || s === "labtests") {
    return DIAG_SUB_LAB_TESTS;
  }
  return null;
}

function readModulesToHideTokens(mod: Record<string, unknown>): string[] {
  const raw =
    mod.modulesToHide ??
    mod.modules_to_hide ??
    mod.hideModulesToHide;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const slug = normalizeDiagnosticsHideToken(item);
    if (slug) out.push(slug);
  }
  return out;
}

/** `hideModulesInApp` may be boolean (hide whole Lab) or string[] (same as modulesToHide). */
function collectLabSubHides(lab: Record<string, unknown>): string[] {
  const out: string[] = [];
  const hma = lab.hideModulesInApp;
  if (Array.isArray(hma)) {
    for (const x of hma) {
      if (typeof x !== "string") continue;
      const slug = normalizeDiagnosticsHideToken(x);
      if (slug) out.push(slug);
    }
  }
  out.push(...readModulesToHideTokens(lab));
  return out;
}

function pickModule(
  modules: Record<string, unknown>,
  canonical: string,
): Record<string, unknown> | null {
  const keys = Object.keys(modules);
  const lower = canonical.toLowerCase();
  for (const k of keys) {
    if (k.toLowerCase() === lower) {
      return asRecord(modules[k]);
    }
  }
  return null;
}

/** True when Lab/Diagnostic lists specific branches to hide (`modulesToHide` or array `hideModulesInApp`). */
function labModuleHasExplicitSubRouteHides(block: Record<string, unknown>): boolean {
  if (readModulesToHideTokens(block).length > 0) return true;
  const hma = block.hideModulesInApp;
  if (Array.isArray(hma) && hma.some((x) => typeof x === "string" && x.trim())) return true;
  return false;
}

/**
 * Derives dashboard flags from profile JSON (same shape as verify/profile samples).
 */
export function parseSubscriptionDashboardModules(body: unknown): SubscriptionDashboardModules {
  const profile = extractProfileRecord(body);
  if (!profile) {
    return {
      gateOk: false,
      showLabDiagnosticsTile: false,
      showAhcBanner: false,
      diagnosticsHiddenSubSlugs: new Set(),
    };
  }

  const isSubscribed = coerceBool(profile.isSubscribed ?? profile.is_subscribed);
  const subs = profile.subscription ?? profile.subscriptions;
  const subscriptionArr = Array.isArray(subs) ? subs : [];

  const gateOk = isSubscribed === true && subscriptionArr.length > 0;

  let labActive = false;
  let labHideWhole = false;
  const hiddenSubSlugs = new Set<string>();

  for (const sub of subscriptionArr) {
    const row = asRecord(sub);
    const plan = asRecord(row?.plan);
    const modules = asRecord(plan?.modules);
    if (!modules) continue;

    const lab = pickModule(modules, "Lab");
    const diagnostic = pickModule(modules, "Diagnostic");
    const labBlocks = [lab, diagnostic].filter((x): x is Record<string, unknown> => x != null);
    if (labBlocks.length === 0) continue;

    for (const block of labBlocks) {
      if (coerceBool(block.active)) labActive = true;
      /**
       * Boolean `hideModulesInApp: true` alone = hide all Lab UI (dashboard tile + flows).
       * If `modulesToHide` / array hides are present, only those sub-routes are gated — keep the
       * diagnostics card when at least one branch remains (e.g. `package` hides health checkups only).
       */
      if (
        block.hideModulesInApp === true &&
        !labModuleHasExplicitSubRouteHides(block)
      ) {
        labHideWhole = true;
      }
      for (const slug of collectLabSubHides(block)) {
        hiddenSubSlugs.add(slug);
      }
    }
  }

  const anyDiagnosticsEntry =
    !hiddenSubSlugs.has(DIAG_SUB_HEALTH_CHECKUPS) ||
    !hiddenSubSlugs.has(DIAG_SUB_LAB_TESTS);

  const showLabDiagnosticsTile =
    gateOk && labActive && !labHideWhole && anyDiagnosticsEntry;

  const showAhcBanner =
    gateOk &&
    labActive &&
    !labHideWhole &&
    !hiddenSubSlugs.has(DIAG_SUB_HEALTH_CHECKUPS);

  return {
    gateOk,
    showLabDiagnosticsTile,
    showAhcBanner,
    diagnosticsHiddenSubSlugs: hiddenSubSlugs,
  };
}
