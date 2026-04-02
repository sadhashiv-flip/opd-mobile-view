import type { VerifyLinkKind } from "@/lib/parseVerifyLink";

/** Router `location.state` for OTP screen (DIP: pages depend on this shape, not `unknown`). */
export type OtpLocationState = Readonly<{
  phone?: string;
}>;

/** Router `location.state` for post-verify account linking (PHONE or EMAIL). */
export type AccountLinkLocationState = Readonly<{
  linkKind: Exclude<VerifyLinkKind, "NONE">;
}>;
