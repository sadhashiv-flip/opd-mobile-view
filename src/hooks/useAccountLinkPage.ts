import type { ClipboardEvent, KeyboardEvent, MutableRefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchPatientProfileRaw } from "@/api/patientProfile";
import {
  requestAccountLinkOtp,
  verifyAccountLink,
} from "@/api/patientAccountLink";
import { MIN_PHONE_DIGITS } from "@/constants";
import { digitsOnly, takeDigits } from "@/lib/digits";
import { saveAuthSession } from "@/lib/authStorage";
import { completeAuthAndNavigate } from "@/lib/postVerifyNavigation";
import type { AccountLinkLocationState } from "@/types/navigation";
import { useToast } from "@/hooks/useToast";
import { getWebFcmToken } from "@/lib/fcmToken";
import { useOtpInput } from "./useOtpInput";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type InvalidAccountLink = Readonly<{ kind: "invalid" }>;

type OkAccountLink = Readonly<{
  kind: "ok";
  linkKind: "PHONE" | "EMAIL";
  step: "value" | "otp";
  rawInput: string;
  setRawInput: (v: string) => void;
  valueValid: boolean;
  handleSendOtp: () => Promise<void>;
  sending: boolean;
  linkValue: string;
  handleEditValue: () => void;
  handleResend: () => Promise<void>;
  handleConfirm: () => Promise<void>;
  isSubmitting: boolean;
  digits: string[];
  inputsRef: MutableRefObject<(HTMLInputElement | null)[]>;
  otpComplete: boolean;
  handlePaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  handleChange: (index: number, raw: string) => void;
  handleKeyDown: (index: number, e: KeyboardEvent<HTMLInputElement>) => void;
  slotKeys: readonly string[];
  otpLen: number;
}>;

export type AccountLinkPageController = InvalidAccountLink | OkAccountLink;

export function useAccountLinkPage(): AccountLinkPageController {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = location.state as AccountLinkLocationState | null;
  const linkKind = state?.linkKind;

  const [step, setStep] = useState<"value" | "otp">("value");

  const otp = useOtpInput({ autoFocus: step === "otp" });
  const { resend: resetOtpDigits } = otp;
  const [rawInput, setRawInputState] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [sending, setSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void getWebFcmToken();
  }, []);

  const setRawInputPhone = useCallback((v: string) => {
    setRawInputState(takeDigits(v, MIN_PHONE_DIGITS));
  }, []);

  const setRawInputEmail = useCallback((v: string) => {
    setRawInputState(v);
  }, []);

  const validKind = linkKind === "PHONE" || linkKind === "EMAIL";

  const normalizedValue =
    linkKind === "PHONE" ? digitsOnly(rawInput) : rawInput.trim();

  const valueValid =
    linkKind === "PHONE"
      ? digitsOnly(rawInput).length === MIN_PHONE_DIGITS
      : EMAIL_RE.test(rawInput.trim());

  const handleSendOtp = useCallback(async () => {
    if (!validKind || !valueValid) return;
    const v = normalizedValue;
    setSending(true);
    try {
      const fcm_token = await getWebFcmToken();
      await requestAccountLinkOtp(v, fcm_token);
      setLinkValue(v);
      setStep("otp");
      resetOtpDigits();
      toast.success("OTP sent successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setSending(false);
    }
  }, [validKind, valueValid, normalizedValue, resetOtpDigits, toast]);

  const handleResend = useCallback(async () => {
    if (!linkValue) return;
    try {
      const fcm_token = await getWebFcmToken();
      await requestAccountLinkOtp(linkValue, fcm_token);
      resetOtpDigits();
      toast.success("OTP resent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resend");
    }
  }, [linkValue, resetOtpDigits, toast]);

  const handleConfirm = useCallback(async () => {
    if (!otp.otpComplete || !linkValue) return;
    const code = otp.digits.join("");
    setIsSubmitting(true);
    try {
      const fcm_token = await getWebFcmToken();
      const data = await verifyAccountLink({
        action: "LINK",
        value: linkValue,
        code,
        fcm_token,
      });
      await saveAuthSession(data);
      void fetchPatientProfileRaw().catch(() => {});
      toast.success(data.message?.trim() || "Account linked successfully");
      await completeAuthAndNavigate(navigate, data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [otp.otpComplete, otp.digits, linkValue, toast, navigate]);

  const handleEditValue = useCallback(() => {
    setStep("value");
    resetOtpDigits();
  }, [resetOtpDigits]);

  if (!validKind) {
    return { kind: "invalid" };
  }

  return {
    kind: "ok",
    linkKind,
    step,
    rawInput,
    setRawInput:
      linkKind === "PHONE" ? setRawInputPhone : setRawInputEmail,
    valueValid,
    handleSendOtp,
    sending,
    linkValue,
    handleEditValue,
    handleResend,
    handleConfirm,
    isSubmitting,
    digits: otp.digits,
    inputsRef: otp.inputsRef,
    otpComplete: otp.otpComplete,
    handlePaste: otp.handlePaste,
    handleChange: otp.handleChange,
    handleKeyDown: otp.handleKeyDown,
    slotKeys: otp.slotKeys,
    otpLen: otp.otpLen,
  };
}
