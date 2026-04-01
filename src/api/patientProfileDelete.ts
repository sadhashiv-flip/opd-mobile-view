import { patientFetchChecked } from "@/api/patientHttp";

export type ProfileDeletePayload = Readonly<{
  feedback: string;
}>;

/** PATCH /patient/profile/delete — authenticated account deletion request. */
export async function requestProfileDeletion(
  payload: ProfileDeletePayload,
): Promise<void> {
  const res = await patientFetchChecked("profile/delete", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  await res.text();
}
