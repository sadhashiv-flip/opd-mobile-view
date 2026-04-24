import { patientFetchChecked, patientJson } from "@/api/patientHttp";
import type { VerifySuccessResponse } from "@/types/authSession";

/** POST /patient/link — send OTP to phone or email (authenticated). */
export async function requestAccountLinkOtp(
  value: string,
  fcm_token: string,
): Promise<void> {
  const res = await patientFetchChecked("link", {
    method: "POST",
    body: JSON.stringify({ value, fcm_token }),
  });
  await res.text();
}

export type PatientVlinkPayload = Readonly<{
  action: "LINK";
  value: string;
  code: string;
  fcm_token: string;
}>;

/** POST /patient/vlink — confirm link OTP (authenticated). */
export async function verifyAccountLink(
  payload: PatientVlinkPayload,
): Promise<VerifySuccessResponse> {
  return patientJson<VerifySuccessResponse>("vlink", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
