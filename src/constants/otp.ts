export const OTP_LEN = 6;

export const OTP_SLOT_KEYS = Array.from(
  { length: OTP_LEN },
  (_, i) => `otp-${i}`,
) as readonly string[];
