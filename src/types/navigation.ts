import type { RequiredLabTestsData } from "@/api/patientRequiredLabTests";
import type { VerifyLinkKind } from "@/lib/parseVerifyLink";

/** Router `location.state` for OTP screen (DIP: pages depend on this shape, not `unknown`). */
export type OtpLocationState = Readonly<{
  phone?: string;
}>;

/** Router `location.state` for post-verify account linking (PHONE or EMAIL). */
export type AccountLinkLocationState = Readonly<{
  linkKind: Exclude<VerifyLinkKind, "NONE">;
}>;

export type UserDetailsPersonalLocationState = Readonly<{
  fullName?: string;
  dob?: string;
  language?: string;
  isDiabetic?: "yes" | "no";
  isBloodPressure?: "yes" | "no";
  gender?: "male" | "female" | "other";
  age?: number | null;
}>;

/** Router `location.state` for BMI step — onboarding or digital diary (`startFromBmi`). */
export type UserDetailsBmiLocationState = UserDetailsPersonalLocationState &
  Readonly<{
    /** Digital diary height/weight tiles — POST `/patient/parameters` instead of PATCH healthscore. */
    startFromBmi?: boolean;
    returnPath?: string;
    heightCm?: number;
    weightKg?: number;
  }>;

export type UserDetailsBmiResultLocationState = Readonly<{
  bmi: number;
  heightCm: number;
  weightKg: number;
  nutritionSuggestion: boolean;
  message?: string;
  returnPath?: string;
}>;

/** Router `location.state` for required lab tests gate (from {@link ROUTES.requiredLabTests}). */
export type RequiredLabTestsLocationState = Readonly<{
  labTests: RequiredLabTestsData;
}>;
