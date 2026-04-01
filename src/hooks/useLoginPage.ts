import { useEffect, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { registerPatientLogin } from "@/api/patientRegister";
import { DEMO_PHONE, MIN_PHONE_DIGITS, ROUTES } from "@/constants";
import { digitsOnly } from "@/lib/digits";
import { useToast } from "@/hooks/useToast";

type LoginPageController = Readonly<{
  filled: boolean;
  contact: string;
  setContact: (value: string) => void;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  canProceed: boolean;
  handleConfirm: () => void | Promise<void>;
  labelText: string;
  isSubmitting: boolean;
}>;

/**
 * Login / signup step: contact + terms + navigation to `/login` or `/otp`.
 * Presentation stays in `LoginPage`; orchestration lives here (SRP).
 */
export function useLoginPage(): LoginPageController {
  const navigate = useNavigate();
  const toast = useToast();
  const filled = Boolean(useMatch({ path: ROUTES.login, end: true }));
  const [contact, setContact] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (filled) {
      setContact(DEMO_PHONE);
      setAccepted(true);
    }
  }, [filled]);

  const isValidPhone = digitsOnly(contact).length >= MIN_PHONE_DIGITS;
  const canProceed = accepted && isValidPhone;

  const handleConfirm = async () => {
    if (filled) {
      if (!canProceed) return;
      setIsSubmitting(true);
      try {
        await registerPatientLogin({
          phone: digitsOnly(contact),
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
      return;
    }
    if (canProceed) {
      navigate(ROUTES.login);
    }
  };

  const labelText = filled
    ? "Mobile Number | Email id"
    : "Mobile Number / Email id";

  return {
    filled,
    contact,
    setContact,
    accepted,
    setAccepted,
    canProceed,
    handleConfirm,
    labelText,
    isSubmitting,
  };
}
