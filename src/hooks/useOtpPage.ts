import { useNavigate, useLocation } from "react-router-dom";
import { DEMO_PHONE, ROUTES } from "@/constants";
import type { OtpLocationState } from "@/types/navigation";
import { useOtpInput } from "./useOtpInput";

type OtpPageController = Omit<ReturnType<typeof useOtpInput>, "resend"> &
  Readonly<{
    phone: string;
    handleEdit: () => void;
    handleConfirm: () => void;
    handleResend: () => void;
  }>;

/**
 * OTP screen: resolves phone from router state + wires navigation (SRP vs `useOtpInput`).
 */
export function useOtpPage(): OtpPageController {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as OtpLocationState | null;
  const phone = state?.phone ?? DEMO_PHONE;

  const input = useOtpInput();
  const { resend, ...inputRest } = input;

  const handleEdit = () => {
    navigate(ROUTES.login);
  };

  const handleConfirm = () => {
    if (!input.otpComplete) return;
    navigate(ROUTES.dashboard);
  };

  return {
    ...inputRest,
    phone,
    handleEdit,
    handleConfirm,
    handleResend: resend,
  };
}
