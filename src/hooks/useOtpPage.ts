import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { verifyPatientLogin } from "@/api/patientVerify";
import { DEMO_PHONE, ROUTES } from "@/constants";
import { completeAuthAndNavigate } from "@/lib/postVerifyNavigation";
import { saveAuthSession } from "@/lib/authStorage";
import type { OtpLocationState } from "@/types/navigation";
import { useToast } from "@/hooks/useToast";
import { useOtpInput } from "./useOtpInput";

type OtpPageController = Omit<ReturnType<typeof useOtpInput>, "resend"> &
  Readonly<{
    phone: string;
    handleEdit: () => void;
    handleConfirm: () => void | Promise<void>;
    handleResend: () => void;
    isSubmitting: boolean;
  }>;

/**
 * OTP screen: resolves phone from router state + wires navigation (SRP vs `useOtpInput`).
 */
export function useOtpPage(): OtpPageController {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const state = location.state as OtpLocationState | null;
  const phone = state?.phone ?? DEMO_PHONE;

  const input = useOtpInput();
  const { resend, ...inputRest } = input;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEdit = () => {
    navigate(ROUTES.login);
  };

  const handleConfirm = async () => {
    if (!input.otpComplete) return;
    const code = input.digits.join("");
    setIsSubmitting(true);
    try {
      const data = await verifyPatientLogin({
        action: "RLOGIN",
        value: phone.trim(),
        code,
        fcm_token: "",
      });
      await saveAuthSession(data);
      toast.success(data.message?.trim() || "Login successful");
      await completeAuthAndNavigate(navigate, data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    ...inputRest,
    phone,
    handleEdit,
    handleConfirm,
    handleResend: resend,
    isSubmitting,
  };
}
