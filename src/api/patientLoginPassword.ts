import { patientJson } from "@/api/patientHttp";
import type { VerifySuccessResponse } from "@/types/authSession";

/** POST /patient/login — password login (same success shape as verify when applicable). */
export type PatientPasswordLoginPayload = Readonly<{
  phone: string;
  password: string;
  corporate: boolean;
  fcm_token: string;
  tc_accepted: boolean;
}>;

export async function loginPatientWithPassword(
  payload: PatientPasswordLoginPayload,
): Promise<VerifySuccessResponse> {
  return patientJson<VerifySuccessResponse>("login", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}
