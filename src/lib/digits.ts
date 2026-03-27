/** Strip non-digits (pure function — easy to test, SRP). */
export function digitsOnly(value: string): string {
  return value.replaceAll(/\D/g, "");
}

/** First `maxLen` digits from arbitrary text (paste / OTP). */
export function takeDigits(text: string, maxLen: number): string {
  return digitsOnly(text).slice(0, maxLen);
}
