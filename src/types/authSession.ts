/** Patient profile returned from POST /patient/verify */

export type AuthUser = Readonly<{
  name: string;
  email: string | null;
  phone: string;
  dob: string | null;
  image: string | null;
  gender: string | null;
  isBloodPressure: string | null;
  isDiabetic: string | null;
  bloodGroup: string | null;
  occupation: string | null;
  isChronic: string | null;
  language: string | null;
  vip: boolean;
  empId: string | null;
  device_id: string | null;
  platform: string | null;
  ref_code: string | null;
  ref_by: string | null;
  relationship: string | null;
  jm_user_id: string | null;
  md_user_id: string | null;
  testAccount: boolean;
  personal_account: boolean;
  account_transferred_date: string | null;
  date_of_joining: string | null;
  hasPIN: boolean;
  first_name: string;
  last_name: string;
  age: number | null;
  hasPassword: boolean;
  id: number;
  type: string;
  primary: string;
  freeConsultations: number;
  corporate_id: number | null;
  status: number;
  cugc: unknown;
  cuid: unknown;
  cdid: unknown;
  createdAt: string;
  updatedAt: string;
}>;

/** Successful verify API body (encrypted at rest in localStorage). */
export type VerifySuccessResponse = Readonly<{
  user: AuthUser;
  token: string;
  isReg: boolean;
  link: string;
  message?: string;
}>;

/** Subset persisted after login. */
export type StoredAuthSession = Readonly<{
  user: AuthUser;
  token: string;
  isReg: boolean;
  link: string;
  message?: string;
}>;
