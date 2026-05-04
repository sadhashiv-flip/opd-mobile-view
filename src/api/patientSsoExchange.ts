import { patientFetch, patientJsonRoot } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";
import {
  mapProfileBodyToAuthUser,
  readIsRegFromProfileBody,
  readLinkFromProfileBody,
} from "@/lib/sso/profilePayloadToAuthUser";
import type { VerifySuccessResponse } from "@/types/authSession";

/** IAM OAuth-style token endpoint body (`POST …/iam/auth/sso/token-exchange`). */
export type IamSsoTokenExchangeResponse = Readonly<{
  access_token: string;
  token_type?: string;
}>;

async function fetchProfileJsonWithBearer(accessToken: string): Promise<unknown> {
  const res = await patientFetch("profile", {
    method: "GET",
    skipAuth: true,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  if (!text) {
    throw new Error(`Empty profile response (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Invalid JSON profile response (HTTP ${res.status})`);
  }
}

/**
 * Exchange IAM-issued SSO JWT for a patient session:
 * 1. `POST …/iam/auth/sso/token-exchange` → `{ access_token, token_type }`
 * 2. `GET …/patient/profile` with `Authorization: Bearer access_token` → user + verify-style flags.
 */
export async function exchangeIamSsoTokenForSession(
  iamJwt: string,
): Promise<VerifySuccessResponse> {
  const path = import.meta.env.VITE_SSO_EXCHANGE_PATH?.trim() || "iam/auth/sso/token-exchange";
  const raw = await patientJsonRoot<IamSsoTokenExchangeResponse>(path, {
    method: "POST",
    body: JSON.stringify({ grant_type: "sso_token", token: iamJwt }),
    skipAuth: true,
  });
  const accessToken = typeof raw.access_token === "string" ? raw.access_token.trim() : "";
  if (!accessToken) {
    throw new Error("Token exchange did not return access_token");
  }

  const profileBody = await fetchProfileJsonWithBearer(accessToken);
  const user = mapProfileBodyToAuthUser(profileBody);

  return {
    user,
    token: accessToken,
    isReg: readIsRegFromProfileBody(profileBody),
    link: readLinkFromProfileBody(profileBody),
  };
}
