import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginPatientWithPassword } from "@/api/patientLoginPassword";
import { registerPatientLogin } from "@/api/patientRegister";
import {
  MIN_LOGIN_PASSWORD_LENGTH,
  MIN_PHONE_DIGITS,
  ROUTES,
} from "@/constants";
import { useToast } from "@/hooks/useToast";
import { saveAuthSession } from "@/lib/authStorage";
import { digitsOnly, takeDigits } from "@/lib/digits";

function normalizeContactInput(raw: string): string {
  if (raw.includes("@") || /[a-zA-Z]/.test(raw)) {
    return raw;
  }
  return takeDigits(raw, MIN_PHONE_DIGITS);
}

type LoginPageController = Readonly<{
  contact: string;
  setContact: (value: string) => void;
  /** Exactly {@link MIN_PHONE_DIGITS} digits → green border + check (mobile). */
  phoneComplete: boolean;
  usePasswordLogin: boolean;
  setUsePasswordLogin: (value: boolean) => void;
  password: string;
  setPassword: (value: string) => void;
  passwordVisible: boolean;
  setPasswordVisible: (value: boolean) => void;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  canProceed: boolean;
  handleConfirm: () => void | Promise<void>;
  labelText: string;
  isSubmitting: boolean;
  otpSubtitle: string;
}>;

/**
 * Login: mobile (10 digits) + optional password toggle; OTP uses POST /register (RLOGIN).
 */
export function useLoginPage(): LoginPageController {
  const navigate = useNavigate();
  const toast = useToast();
  const [contact, setContactState] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usePasswordLogin, setUsePasswordLoginState] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const setContact = (value: string) => {
    setContactState(normalizeContactInput(value));
  };

  const setUsePasswordLogin = (next: boolean) => {
    setUsePasswordLoginState(next);
    if (!next) {
      setPassword("");
      setPasswordVisible(false);
    }
  };

  const phoneDigits = digitsOnly(contact);
  const phoneComplete = phoneDigits.length === MIN_PHONE_DIGITS;

  const passwordOk =
    password.trim().length >= MIN_LOGIN_PASSWORD_LENGTH;

  const canProceedOtp = accepted && phoneComplete && !usePasswordLogin;
  const canProceedPassword =
    accepted && phoneComplete && usePasswordLogin && passwordOk;
  const canProceed = canProceedOtp || canProceedPassword;

  const handleConfirm = async () => {
    if (!canProceed) return;
    setIsSubmitting(true);
    try {
      if (usePasswordLogin) {
        const data = await loginPatientWithPassword({
          phone: phoneDigits,
          password: password.trim(),
          corporate: true,
          fcm_token: "",
          tc_accepted: accepted,
        });
        await saveAuthSession(data);
        toast.success(data.message?.trim() || "Login successful");
        navigate(ROUTES.dashboard, { replace: true });
        return;
      }

      await registerPatientLogin({
        phone: phoneDigits,
        type: "RLOGIN",
        corporate: true,
        fcm_token: "",
        tc_accepted: accepted,
      });
      toast.success("OTP sent successfully");
      navigate(ROUTES.otp, { state: { phone: contact } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    contact,
    setContact,
    phoneComplete,
    usePasswordLogin,
    setUsePasswordLogin,
    password,
    setPassword,
    passwordVisible,
    setPasswordVisible,
    accepted,
    setAccepted,
    canProceed,
    handleConfirm,
    labelText: "Mobile number",
    isSubmitting,
    otpSubtitle: "You will receive an OTP",
  };
}
