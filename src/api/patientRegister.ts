import { patientFetchChecked } from "@/api/patientHttp";

/** POST /patient/register — RLOGIN (OTP) per backend contract. */

export type PatientRegisterPayload = Readonly<{
  phone: string;
  type: "RLOGIN";
  corporate: boolean;
  fcm_token: string;
  tc_accepted: boolean;
}>;

/**
 * Triggers OTP for login; navigates to OTP screen only after success.
 */
export async function registerPatientLogin(
  payload: PatientRegisterPayload,
): Promise<void> {
  if (import.meta.env.DEV) {
    console.log(
      "[FCM] POST /patient/register payload.fcm_token length:",
      payload.fcm_token.length,
      "| preview:",
      payload.fcm_token ? `${payload.fcm_token.slice(0, 20)}…` : "(empty string)",
    );
  }
  const res = await patientFetchChecked("register", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
  await res.text();
}
