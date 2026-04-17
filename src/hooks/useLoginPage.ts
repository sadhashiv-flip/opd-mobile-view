import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginPatientWithPassword } from "@/api/patientLoginPassword";
import { registerPatientLogin } from "@/api/patientRegister";
import {
  MIN_LOGIN_PASSWORD_LENGTH,
  MIN_PHONE_DIGITS,
  ROUTES,
} from "@/constants";
import { useToast } from "@/hooks/useToast";
import { getWebFcmToken } from "@/lib/fcmToken";
import { completeAuthAndNavigate } from "@/lib/postVerifyNavigation";
import { saveAuthSession } from "@/lib/authStorage";
import { digitsOnly, takeDigits } from "@/lib/digits";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeContactInput(raw: string): string {
  if (raw.includes("@") || /[a-zA-Z]/.test(raw)) {
    return raw;
  }
  return takeDigits(raw, MIN_PHONE_DIGITS);
}

type LoginPageController = Readonly<{
  contact: string;
  setContact: (value: string) => void;
  /**
   * Valid contact input:
   * - exactly {@link MIN_PHONE_DIGITS} digits for mobile, or
   * - syntactically valid email → green border + check.
   */
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

  const isEmail = contact.includes("@") || /[a-zA-Z]/.test(contact);
  const trimmedContact = contact.trim();
  const phoneDigits = isEmail ? "" : digitsOnly(contact);
  const phoneComplete = !isEmail && phoneDigits.length === MIN_PHONE_DIGITS;
  const emailValid = isEmail && EMAIL_REGEX.test(trimmedContact);
  const contactValid = phoneComplete || emailValid;

  const passwordOk =
    password.trim().length >= MIN_LOGIN_PASSWORD_LENGTH;

  const canProceedOtp = accepted && contactValid && !usePasswordLogin;
  const canProceedPassword =
    accepted && contactValid && usePasswordLogin && passwordOk;
  const canProceed = canProceedOtp || canProceedPassword;

  /** Eager FCM token + localStorage persist so POST /register and later /verify send a real `fcm_token` when the browser allows. */
  useEffect(() => {
    void getWebFcmToken();
  }, []);

  const handleConfirm = async () => {
    if (!canProceed) return;
    setIsSubmitting(true);
    try {
      const identifier = isEmail ? trimmedContact : phoneDigits;
      const fcm_token = await getWebFcmToken();

      if (usePasswordLogin) {
        const data = await loginPatientWithPassword({
          phone: identifier,
          password: password.trim(),
          corporate: true,
          fcm_token,
          tc_accepted: accepted,
        });
        await saveAuthSession(data);
        toast.success(data.message?.trim() || "Login successful");
        await completeAuthAndNavigate(navigate, data);
        return;
      }

      await registerPatientLogin({
        phone: identifier,
        type: "RLOGIN",
        corporate: true,
        fcm_token,
        tc_accepted: accepted,
      });
      toast.success("OTP sent successfully");
      navigate(ROUTES.otp, { state: { phone: identifier } });
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
    labelText: "Mobile number or email",
    isSubmitting,
    otpSubtitle: "You will receive an OTP",
  };
}
