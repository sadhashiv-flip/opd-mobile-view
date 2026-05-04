import type { AuthUser, VerifySuccessResponse } from "@/types/authSession";

/** Short label from IAM JWT for mock token / debugging (not cryptographic). */
function tokenFingerprint(iamJwt: string): string {
  const t = iamJwt.trim();
  if (t.length <= 16) return t || "empty";
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

/**
 * Dev / pre-API body matching {@link VerifySuccessResponse}. Bear token is not valid for real APIs.
 */
export function buildMockVerifySuccessResponse(iamJwt: string): VerifySuccessResponse {
  const now = new Date().toISOString();
  const fp = tokenFingerprint(iamJwt);
  const user: AuthUser = {
    name: "SSO mock user",
    email: "sso-mock@example.invalid",
    phone: "+910000000000",
    dob: null,
    image: null,
    gender: null,
    isBloodPressure: null,
    isDiabetic: null,
    bloodGroup: null,
    occupation: null,
    isChronic: null,
    language: null,
    vip: false,
    empId: null,
    device_id: null,
    platform: "web",
    ref_code: null,
    ref_by: null,
    relationship: null,
    jm_user_id: null,
    md_user_id: null,
    testAccount: true,
    personal_account: true,
    account_transferred_date: null,
    date_of_joining: null,
    hasPIN: false,
    first_name: "SSO",
    last_name: "Mock",
    age: null,
    hasPassword: false,
    id: 9_000_001,
    type: "patient",
    primary: "phone",
    freeConsultations: 0,
    corporate_id: null,
    status: 1,
    cugc: null,
    cuid: null,
    cdid: null,
    createdAt: now,
    updatedAt: now,
  };

  return {
    user,
    token: `sso-mock-bearer-${fp.replaceAll(/[^a-zA-Z0-9]/g, "")}`,
    isReg: true,
    link: "NONE",
    message: "Mock SSO session — set VITE_SSO_USE_MOCK=false when API is ready.",
  };
}
