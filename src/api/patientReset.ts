import { patientFetchChecked } from "@/api/patientHttp";

export type ResetPasswordPayload = Readonly<{
  token: string;
  password: string;
  confirmation_password: string;
}>;

/** POST /patient/reset — set new password using reset token (public). */
export async function resetPatientPassword(payload: ResetPasswordPayload): Promise<void> {
  const res = await patientFetchChecked("reset", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
  await res.text();
}
