/** Router `location.state` for OTP screen (DIP: pages depend on this shape, not `unknown`). */
export type OtpLocationState = Readonly<{
  phone?: string;
}>;
