import { useEffect, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { DEMO_PHONE, MIN_PHONE_DIGITS, ROUTES } from "@/constants";
import { digitsOnly } from "@/lib/digits";

type LoginPageController = Readonly<{
  filled: boolean;
  contact: string;
  setContact: (value: string) => void;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  canProceed: boolean;
  handleConfirm: () => void;
  labelText: string;
}>;

/**
 * Login / signup step: contact + terms + navigation to `/login` or `/otp`.
 * Presentation stays in `LoginPage`; orchestration lives here (SRP).
 */
export function useLoginPage(): LoginPageController {
  const navigate = useNavigate();
  const filled = Boolean(useMatch({ path: ROUTES.login, end: true }));
  const [contact, setContact] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (filled) {
      setContact(DEMO_PHONE);
      setAccepted(true);
    }
  }, [filled]);

  const isValidPhone = digitsOnly(contact).length >= MIN_PHONE_DIGITS;
  const canProceed = accepted && isValidPhone;

  const handleConfirm = () => {
    if (filled) {
      navigate(ROUTES.otp, { state: { phone: contact } });
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
  };
}
