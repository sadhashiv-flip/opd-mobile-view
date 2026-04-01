import { patientJson } from "@/api/patientHttp";
import type { VerifySuccessResponse } from "@/types/authSession";

/** POST /patient/verify — OTP confirmation for RLOGIN. */

export type PatientVerifyPayload = Readonly<{
  action: "RLOGIN";
  /** Phone (digits) or identifier matching register step */
  value: string;
  code: string;
  fcm_token: string;
}>;

export async function verifyPatientLogin(
  payload: PatientVerifyPayload,
): Promise<VerifySuccessResponse> {
  return patientJson<VerifySuccessResponse>("verify", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}
