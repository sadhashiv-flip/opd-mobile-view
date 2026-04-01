import { patientFetchChecked, patientJson } from "@/api/patientHttp";

export type ForgotOtpPayload = Readonly<{
  phone: string;
  type: "FORGOT";
}>;

export type VerifyForgotPayload = Readonly<{
  action: "FORGOT";
  value: string;
  code: string;
}>;

export type VerifyForgotSuccess = Readonly<{
  token: string;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Extract reset JWT from verify response (`token` or nested). */
export function extractForgotResetToken(body: unknown): string {
  const root = asRecord(body) ?? {};
  const direct = root.token;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const data = asRecord(root.data);
  const nested = data?.token;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  throw new Error("No reset token in verify response");
}

/** POST /patient/forgot — request OTP for password reset (public). */
export async function requestForgotOtp(payload: ForgotOtpPayload): Promise<void> {
  const res = await patientFetchChecked("forgot", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
  await res.text();
}

/** POST /patient/verify — confirm FORGOT OTP; returns reset `token` for POST /reset. */
export async function verifyForgotOtp(
  payload: VerifyForgotPayload,
): Promise<VerifyForgotSuccess> {
  const raw = await patientJson<unknown>("verify", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
  return { token: extractForgotResetToken(raw) };
}
