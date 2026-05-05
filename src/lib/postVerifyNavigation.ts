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

/**
 * `GET /required_lab_tests` then `/required-lab-tests` or dashboard.
 * Call only **after** registration / health-score onboarding is done — not for `!isReg` users.
 * Fail-open on fetch error so login is not blocked.
 */
export async function navigateDashboardWithLabGate(
  navigate: NavigateFunction,
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
  navigate(ROUTES.dashboard, { replace: true });
}

/**
 * After verify + {@link saveAuthSession}:
 * 1. **Account link** — if `link` is PHONE or EMAIL → `/account/link`.
 * 2. **Health score / registration** — if `!isReg` → `/user-details/personal` (no lab API yet).
 * 3. **Required lab tests** — only when `isReg` (health score path complete per API) → {@link navigateDashboardWithLabGate}.
 */
export async function completeAuthAndNavigate(
  navigate: NavigateFunction,
  verifyData: VerifySuccessResponse,
): Promise<void> {
  const linkKind = parseVerifyLinkKind(verifyData.link);
  if (linkKind === "PHONE" || linkKind === "EMAIL") {
    navigate(ROUTES.accountLink, {
      replace: true,
      state: { linkKind },
    });
    return;
  }

  if (!verifyData.isReg) {
    navigate(ROUTES.userDetailsPersonal, { replace: true });
    return;
  }

  await navigateDashboardWithLabGate(navigate);
}
