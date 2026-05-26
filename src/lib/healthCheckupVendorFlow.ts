import type { HealthSponsoredVendorRow, SponsoredVendorPricingResult } from "@/api/patientDiagnosticsLab";
import {
  readHealthSponsoredFlag,
  writeHealthVendorDraft,
  writeHealthVendorMeta,
} from "@/constants/diagnosticsHealthFlowStorage";
import { clearHealthSlotPicks } from "@/constants/diagnosticsHealthFlowStorage";

/** patient_app `continueToVendorSelection`: skip vendor UI when no selectable vendors. */
export function shouldSkipHealthVendorScreen(pricing: SponsoredVendorPricingResult): boolean {
  return !pricing.hasSelectablePathology && !pricing.hasSelectableRadiology;
}

export type HealthVendorCodePick = Readonly<{
  pathVendorCode: string | null;
  radVendorCode: string | null;
}>;

export type ResolveHealthVendorCodesOptions = Readonly<{
  preferred?: Readonly<{ pathVendorCode?: string | null; radVendorCode?: string | null }>;
  /**
   * Plan → vendors: do not auto-select the only vendor or sponsored default;
   * user must tap a vendor card (still restores `preferred` when returning from slots).
   */
  requireUserSelection?: boolean;
}>;

/** Resolves pathology/radiology vendor codes (uses `unknown` when category exists but only unknown in API). */
export function resolveHealthVendorCodes(
  res: SponsoredVendorPricingResult,
  opts?: ResolveHealthVendorCodesOptions,
): HealthVendorCodePick {
  const requireUserSelection = opts?.requireUserSelection === true;
  const preferred = opts?.preferred;

  const resolveVendorCode = (
    vendors: readonly HealthSponsoredVendorRow[],
    categoryExists: boolean,
    preferredCode: string | null | undefined,
  ): string | null => {
    if (!categoryExists) return null;
    if (vendors.length === 0) return "unknown";
    const code = preferredCode?.trim();
    if (code && vendors.some((v) => v.code === code)) return code;
    if (!requireUserSelection && vendors.length === 1) return vendors[0]?.code ?? null;
    return null;
  };

  const pv = res.pathologyVendors;
  const rv = res.radiologyVendors;
  let pathCode = resolveVendorCode(
    pv,
    res.pathologyCategoryExists,
    preferred?.pathVendorCode,
  );
  let radCode = resolveVendorCode(
    rv,
    res.radiologyCategoryExists,
    preferred?.radVendorCode,
  );

  if (!requireUserSelection && readHealthSponsoredFlag()) {
    if (res.pathologyCategoryExists && pv.length === 1) {
      pathCode = pv[0]?.code ?? pathCode;
    }
    if (res.radiologyCategoryExists && rv.length === 1) {
      radCode = rv[0]?.code ?? radCode;
    }
  }

  return { pathVendorCode: pathCode, radVendorCode: radCode };
}

/** Category flags for slots flow before the user picks vendors on the vendor screen. */
export function writeHealthVendorCategoryMeta(res: SponsoredVendorPricingResult): void {
  writeHealthVendorMeta({
    needPathology: res.pathologyCategoryExists,
    needRadiology: res.radiologyCategoryExists,
    pathVendorCode: "unknown",
    radVendorCode: "unknown",
  });
}

export function commitHealthVendorSelection(
  res: SponsoredVendorPricingResult,
  codes: HealthVendorCodePick,
): void {
  writeHealthVendorMeta({
    needPathology: res.pathologyCategoryExists,
    needRadiology: res.radiologyCategoryExists,
    pathVendorCode: res.pathologyCategoryExists ? codes.pathVendorCode ?? "unknown" : "unknown",
    radVendorCode: res.radiologyCategoryExists ? codes.radVendorCode ?? "unknown" : "unknown",
  });
  writeHealthVendorDraft({
    pathVendorCode: codes.pathVendorCode,
    radVendorCode: codes.radVendorCode,
  });
}

/** Clears prior slot picks only — keeps vendor meta (plan/vendor → slots). */
export function clearHealthSlotSessionBeforeSlots(): void {
  clearHealthSlotPicks();
}
