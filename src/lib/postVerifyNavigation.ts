import type { NavigateFunction } from "react-router-dom";
import { fetchRequiredLabTests } from "@/api/patientRequiredLabTests";
import type { RequiredLabTestsData } from "@/api/patientRequiredLabTests";
import { ROUTES } from "@/constants";
import type { VerifySuccessResponse } from "@/types/authSession";
import { parseVerifyLinkKind } from "@/lib/parseVerifyLink";

/** When both are false, continue normal post-verify routing (dashboard / onboarding / link). */
export function canProceedPastRequiredLabTests(data: RequiredLabTestsData): boolean {
  return data.required_test === false && data.access_block === false;
}

/** After session is saved: dashboard, or account-link flow when `link` is PHONE / EMAIL. */
export function navigateAfterAuthVerify(
  navigate: NavigateFunction,
  data: VerifySuccessResponse,
): void {
  if (!data.isReg) {
    navigate(ROUTES.userDetailsPersonal, { replace: true });
    return;
  }
  const kind = parseVerifyLinkKind(data.link);
  if (kind === "PHONE" || kind === "EMAIL") {
    navigate(ROUTES.accountLink, {
      replace: true,
      state: { linkKind: kind },
    });
    return;
  }
  navigate(ROUTES.dashboard, { replace: true });
}

/**
 * After verify + {@link saveAuthSession}: GET `/required_lab_tests`, then either normal
 * {@link navigateAfterAuthVerify} or the lab-tests flow when `required_test` or `access_block` is true.
 * On fetch failure, falls back to normal navigation so login is not blocked.
 */
export async function completeAuthAndNavigate(
  navigate: NavigateFunction,
  verifyData: VerifySuccessResponse,
): Promise<void> {
  try {
    const res = await fetchRequiredLabTests();
    if (!canProceedPastRequiredLabTests(res.data)) {
      navigate(ROUTES.requiredLabTests, {
        replace: true,
        state: { labTests: res.data },
      });
      return;
    }
  } catch {
    // Fail-open: proceed with existing routing if the check is unavailable.
  }
  navigateAfterAuthVerify(navigate, verifyData);
}
