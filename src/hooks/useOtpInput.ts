import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { OTP_LEN, OTP_SLOT_KEYS } from "@/constants/otp";
import { takeDigits } from "@/lib/digits";

type UseOtpInputOptions = Readonly<{
  /** When false, first box is not focused on mount (e.g. value step before OTP step). */
  autoFocus?: boolean;
}>;

/**
 * Six-box OTP field: input, paste, backspace focus — isolated from routing (SRP).
 */
export function useOtpInput(opts?: UseOtpInputOptions) {
  const autoFocus = opts?.autoFocus !== false;
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: OTP_LEN }, () => ""),
  );
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const applyPastedOtp = useCallback((text: string) => {
    const pasted = takeDigits(text, OTP_LEN);
    if (!pasted) return;
    const next = Array.from({ length: OTP_LEN }, (_, i) => pasted[i] ?? "");
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, OTP_LEN - 1)]?.focus();
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      applyPastedOtp(e.clipboardData.getData("text"));
    },
    [applyPastedOtp],
  );

  const handleChange = useCallback((index: number, raw: string) => {
    const single = takeDigits(raw, 1).slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = single;
      return next;
    });
    if (single && index < OTP_LEN - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  useEffect(() => {
    if (autoFocus) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus]);

  const otpComplete = useMemo(
    () => digits.every((c) => c.length === 1),
    [digits],
  );

  const resend = useCallback(() => {
    setDigits(Array.from({ length: OTP_LEN }, () => ""));
    inputsRef.current[0]?.focus();
  }, []);

  return {
    digits,
    inputsRef,
    otpComplete,
    handlePaste,
    handleChange,
    handleKeyDown,
    resend,
    slotKeys: OTP_SLOT_KEYS,
    otpLen: OTP_LEN,
  };
}
