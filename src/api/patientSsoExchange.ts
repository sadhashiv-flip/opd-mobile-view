import { patientFetch, patientJsonRoot } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";
import {
  mapProfileBodyToAuthUser,
  readIsRegFromProfileBody,
  readLinkFromProfileBody,
} from "@/lib/sso/profilePayloadToAuthUser";
import type { VerifySuccessResponse } from "@/types/authSession";
import { saveCachedProfileRaw } from "@/lib/profileCacheStorage";

/** IAM OAuth-style token endpoint body (`POST …/iam/auth/sso/token-exchange`). */
export type IamSsoTokenExchangeResponse = Readonly<{
  access_token: string;
  token_type?: string;
}>;

function readOptionalRootMessage(body: unknown): string | undefined {
  const r =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const m = r?.message;
  return typeof m === "string" && m.trim() ? m.trim() : undefined;
}

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
    const parsed = JSON.parse(text) as unknown;
    saveCachedProfileRaw(parsed);
    return parsed;
  } catch {
    throw new Error(`Invalid JSON profile response (HTTP ${res.status})`);
  }
}

/** Maps GET `/patient/profile` JSON + bearer token to the same shape as POST `/patient/verify` success. */
export function verifySuccessFromProfileBody(
  profileBody: unknown,
  accessToken: string,
): VerifySuccessResponse {
  const token = accessToken.trim();
  const user = mapProfileBodyToAuthUser(profileBody);
  const message = readOptionalRootMessage(profileBody);
  return {
    user,
    token,
    isReg: readIsRegFromProfileBody(profileBody),
    link: readLinkFromProfileBody(profileBody),
    ...(message ? { message } : {}),
  };
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
  return verifySuccessFromProfileBody(profileBody, accessToken);
}
