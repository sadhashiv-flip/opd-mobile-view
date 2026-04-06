import type { NavigateFunction } from "react-router-dom";
import { ROUTES } from "@/constants";
import type { VerifySuccessResponse } from "@/types/authSession";
import { parseVerifyLinkKind } from "@/lib/parseVerifyLink";

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
