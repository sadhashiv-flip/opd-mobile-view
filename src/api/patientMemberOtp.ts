import { patientFetchChecked } from "@/api/patientHttp";

/** POST /patient/otp — OTP for member phone (`key` = mobile number). */
export async function requestMemberPhoneOtp(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Phone number required");
  const res = await patientFetchChecked("otp", {
    method: "POST",
    body: JSON.stringify({ key: trimmed, action: "MEMBER" }),
  });
  await res.text();
}
