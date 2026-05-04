import { exchangeIamSsoTokenForSession } from "@/api/patientSsoExchange";
import { buildMockVerifySuccessResponse } from "@/lib/sso/mockVerifySuccess";
import type { VerifySuccessResponse } from "@/types/authSession";

/**
 * `VITE_SSO_USE_MOCK`:
 * - `"true"` — always use mock session (no API).
 * - `"false"` — always call {@link exchangeIamSsoTokenForSession}.
 * - unset — mock in dev, real in production.
 */
export function shouldUseSsoMock(): boolean {
  const v = import.meta.env.VITE_SSO_USE_MOCK?.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return import.meta.env.DEV;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
}

/**
 * IAM `token` query param → `POST …/iam/auth/sso/token-exchange` (`access_token`) →
 * `GET /patient/profile` → same shape as POST `/patient/verify` success for storage.
 */
export async function exchangeSsoToken(iamJwt: string): Promise<VerifySuccessResponse> {
  if (shouldUseSsoMock()) {
    await sleep(350);
    return buildMockVerifySuccessResponse(iamJwt);
  }
  return exchangeIamSsoTokenForSession(iamJwt);
}
