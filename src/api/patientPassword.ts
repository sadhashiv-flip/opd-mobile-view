import { patientFetchChecked } from "@/api/patientHttp";

export type ChangePasswordPayload = Readonly<{
  current_password: string;
  new_password: string;
  confirmation_password: string;
}>;

/** POST /patient/password — authenticated. */
export async function changePatientPassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  const res = await patientFetchChecked("password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await res.text();
}
