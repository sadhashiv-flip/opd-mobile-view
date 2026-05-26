import type { Location } from "react-router-dom";
import { ROUTES } from "@/constants";
import type { PharmacyReviewOrderKind } from "@/constants/pharmacyReviewDraft";

/** `location.state` for pharmacy screens — hub exit + immediate back target. */
export type PharmacyFlowNavState = Readonly<{
  /** Where to go when exiting the pharmacy module (dashboard, services hub, …). */
  returnPath?: string;
  /** Previous screen in the pharmacy flow (or external entry). */
  backPath?: string;
}>;

export function readPharmacyHubReturn(
  location: Location,
  fallback: string = ROUTES.dashboard,
): string {
  const st = location.state as PharmacyFlowNavState | null;
  const rp = st?.returnPath?.trim();
  return rp || fallback;
}

export function readPharmacyBackPath(location: Location, fallback: string): string {
  const st = location.state as PharmacyFlowNavState | null;
  const bp = st?.backPath?.trim();
  return bp || fallback;
}

export function pharmacyReviewBackPath(orderKind: PharmacyReviewOrderKind): string {
  switch (orderKind) {
    case "FLIPHEALTH":
      return ROUTES.pharmacySelectPrescription;
    case "UPLOAD":
      return ROUTES.pharmacyUpload;
    case "OTC":
      return ROUTES.pharmacy;
    default: {
      const _e: never = orderKind;
      return _e;
    }
  }
}

export function buildPharmacyPassState(
  hubReturn: string,
  backPath?: string,
): PharmacyFlowNavState {
  return backPath ? { returnPath: hubReturn, backPath } : { returnPath: hubReturn };
}
