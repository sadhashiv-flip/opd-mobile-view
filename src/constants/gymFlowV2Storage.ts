import type { GymOptInLinePayload, GymOptInPreviewData } from "@/api/patientGymSubscription";
import type { GymLineFormModel } from "@/lib/gymSubscriptionFlow";

/** Draft between package screen → location/contact screen (session). */
export const GYM_FLOW_V2_DRAFT_KEY = "opd-mobile-view.gym-flow-v2.draft";

/** Overview confirm step — opt-in preview + payloads for confirm/pay. */
export const GYM_FLOW_V2_OVERVIEW_KEY = "opd-mobile-view.gym-flow-v2.overview";

export type GymFlowV2Draft = Readonly<{
  selectedSubscriptionIndex: number;
  selectedEmployeePackageCodes: readonly string[];
  selectedDependentPackageCodes: readonly string[];
  dependentMemberIdsByPackage: Readonly<Record<string, readonly string[]>>;
}>;

export type GymFlowV2OverviewPayload = Readonly<{
  subscriptionId: string;
  /** Same payload sent to `POST gym/optIn` preview & confirm. */
  optInLines: readonly GymOptInLinePayload[];
  preview: GymOptInPreviewData | null;
  /** Soft totals from preview POST — fallback when preview.lines missing. */
  paymentSummary: Readonly<{
    opt_in_amount: number | null;
    pending_amount: number | null;
    payment_required: boolean;
  }>;
  /** Display rows matching Dart overview “Members & centers”. */
  contactRows: readonly Readonly<{
    packageDisplayName: string;
    memberDisplayName: string;
    isEmployeePackage: boolean;
    locationLabel: string;
    phone: string;
    email: string;
  }>[];
  accountPrimaryUser: Readonly<{
    name: string;
    email: string;
    phone: string;
  }>;
}>;

export function writeGymFlowV2Draft(draft: GymFlowV2Draft): void {
  try {
    sessionStorage.setItem(GYM_FLOW_V2_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function readGymFlowV2Draft(): GymFlowV2Draft | null {
  try {
    const raw = sessionStorage.getItem(GYM_FLOW_V2_DRAFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Partial<GymFlowV2Draft>;
    if (typeof o.selectedSubscriptionIndex !== "number") return null;
    return {
      selectedSubscriptionIndex: o.selectedSubscriptionIndex,
      selectedEmployeePackageCodes: Array.isArray(o.selectedEmployeePackageCodes)
        ? o.selectedEmployeePackageCodes.map(String)
        : [],
      selectedDependentPackageCodes: Array.isArray(o.selectedDependentPackageCodes)
        ? o.selectedDependentPackageCodes.map(String)
        : [],
      dependentMemberIdsByPackage:
        o.dependentMemberIdsByPackage && typeof o.dependentMemberIdsByPackage === "object"
          ? (o.dependentMemberIdsByPackage as Record<string, readonly string[]>)
          : {},
    };
  } catch {
    return null;
  }
}

export function clearGymFlowV2Draft(): void {
  try {
    sessionStorage.removeItem(GYM_FLOW_V2_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function writeGymFlowV2Overview(payload: GymFlowV2OverviewPayload): void {
  try {
    sessionStorage.setItem(GYM_FLOW_V2_OVERVIEW_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readGymFlowV2Overview(): GymFlowV2OverviewPayload | null {
  try {
    const raw = sessionStorage.getItem(GYM_FLOW_V2_OVERVIEW_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Partial<GymFlowV2OverviewPayload>;
    if (typeof o.subscriptionId !== "string" || !Array.isArray(o.optInLines)) return null;
    return o as GymFlowV2OverviewPayload;
  } catch {
    return null;
  }
}

export function clearGymFlowV2Overview(): void {
  try {
    sessionStorage.removeItem(GYM_FLOW_V2_OVERVIEW_KEY);
  } catch {
    /* ignore */
  }
}

/** Round-trip line forms for contact page reload (optional). */
export const GYM_FLOW_V2_LINES_KEY = "opd-mobile-view.gym-flow-v2.lines";

export function writeGymFlowV2LineForms(forms: readonly GymLineFormModel[]): void {
  try {
    sessionStorage.setItem(GYM_FLOW_V2_LINES_KEY, JSON.stringify(forms));
  } catch {
    /* ignore */
  }
}

export function readGymFlowV2LineForms(): GymLineFormModel[] | null {
  try {
    const raw = sessionStorage.getItem(GYM_FLOW_V2_LINES_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return null;
    return p as GymLineFormModel[];
  } catch {
    return null;
  }
}

export function clearGymFlowV2LineForms(): void {
  try {
    sessionStorage.removeItem(GYM_FLOW_V2_LINES_KEY);
  } catch {
    /* ignore */
  }
}
