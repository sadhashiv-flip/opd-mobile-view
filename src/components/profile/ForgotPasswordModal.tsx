import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { requestForgotOtp, verifyForgotOtp } from "@/api/patientForgot";
import { getWebFcmToken } from "@/lib/fcmToken";
import { resetPatientPassword } from "@/api/patientReset";
import { MIN_PHONE_DIGITS } from "@/constants/auth";
import { getAuthSession } from "@/lib/authStorage";
import {
  clearForgotResetToken,
  getForgotResetToken,
  saveForgotResetToken,
} from "@/lib/forgotResetToken";
import { digitsOnly } from "@/lib/digits";
import { useOtpInput } from "@/hooks/useOtpInput";
import "./ProfileAccountModals.css";

const RESEND_COOLDOWN_SEC = 30;
const MIN_NEW_PASSWORD_LEN = 6;

type Banner =
  | Readonly<{ variant: "error"; text: string }>
  | Readonly<{ variant: "success"; text: string }>;

function maskPhone(phoneDigits: string): string {
  const d = digitsOnly(phoneDigits);
  if (d.length <= 4) return d || "—";
  const hidden = Math.max(d.length - 4, 4);
  return `${"●".repeat(Math.min(hidden, 8))}${d.slice(-4)}`;
}

/** Mask all but last 2 digits (e.g. `********89`) for forgot-password hint. */
function maskPhoneLastTwoVisible(phoneDigits: string): string {
  const d = digitsOnly(phoneDigits);
  if (d.length < 2) return "••";
  const last2 = d.slice(-2);
  const stars = Math.max(0, d.length - 2);
  return `${"*".repeat(stars)}${last2}`;
}

function ForgotPhoneHint({
  registeredDigits,
  minDigits,
}: Readonly<{ registeredDigits: string | null | undefined; minDigits: number }>) {
  if (registeredDigits === undefined) {
    return (
      <span className="fp-modal__phone-hint fp-modal__phone-hint--loading" aria-hidden>
        …
      </span>
    );
  }
  const d = digitsOnly(registeredDigits ?? "");
  if (d.length >= minDigits) {
    return (
      <span className="fp-modal__phone-hint" aria-hidden>
        {maskPhoneLastTwoVisible(d)}
      </span>
    );
  }
  return null;
}

type ForgotPasswordOtpStepProps = Readonly<{
  otpTitleId: string;
  phoneDigits: string;
  onBack: () => void;
  onOtpVerified: () => void;
}>;

function ForgotPasswordOtpStep({
  otpTitleId,
  phoneDigits,
  onBack,
  onOtpVerified,
}: ForgotPasswordOtpStepProps) {
  const legendId = useId();
  const {
    digits,
    inputsRef,
    otpComplete,
    handlePaste,
    handleChange,
    handleKeyDown,
    resend: clearOtpDigits,
    slotKeys,
    otpLen,
  } = useOtpInput();

  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendSec, setResendSec] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    void getWebFcmToken();
  }, []);

  useEffect(() => {
    if (resendSec <= 0) return;
    const t = globalThis.setInterval(() => {
      setResendSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => globalThis.clearInterval(t);
  }, [resendSec]);

  const handleResend = async () => {
    if (resendSec > 0 || submitting) return;
    setBanner(null);
    try {
      const fcm_token = await getWebFcmToken();
      await requestForgotOtp({ phone: phoneDigits, type: "FORGOT", fcm_token });
      clearOtpDigits();
      setResendSec(RESEND_COOLDOWN_SEC);
      setBanner({ variant: "success", text: "A new OTP has been sent to your number." });
    } catch (e) {
      setBanner({
        variant: "error",
        text: e instanceof Error ? e.message : "Could not resend OTP",
      });
    }
  };

  const handleVerify = async () => {
    if (!otpComplete || submitting) return;
    setBanner(null);
    setSubmitting(true);
    try {
      const fcm_token = await getWebFcmToken();
      const { token } = await verifyForgotOtp({
        action: "FORGOT",
        value: phoneDigits,
        code: digits.join(""),
        fcm_token,
      });
      saveForgotResetToken(token);
      onOtpVerified();
    } catch (e) {
      setBanner({
        variant: "error",
        text: e instanceof Error ? e.message : "Invalid or expired OTP",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fp-modal__top-row">
        <button type="button" className="fp-modal__back" onClick={onBack} disabled={submitting}>
          ← Back
        </button>
        <h2 id={otpTitleId} className="fp-modal__title">
          Enter OTP
        </h2>
        <span className="fp-modal__top-spacer" aria-hidden />
      </div>
      <p className="fp-modal__subtitle">We sent a verification code to</p>
      <p className="fp-modal__phone-display">{maskPhone(phoneDigits)}</p>

      {banner ? (
        <div
          className={`cp-modal__banner cp-modal__banner--${banner.variant}`}
          role={banner.variant === "error" ? "alert" : undefined}
          aria-live={banner.variant === "error" ? "assertive" : "polite"}
        >
          {banner.text}
        </div>
      ) : null}

      <fieldset className="fp-modal__digits" aria-labelledby={legendId}>
        <legend id={legendId} className="visually-hidden">
          Enter {otpLen}-digit OTP
        </legend>
        {slotKeys.map((slotKey, index) => (
          <input
            key={slotKey}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            className="fp-modal__digit"
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${index + 1} of ${otpLen}`}
            value={digits[index]}
            onChange={(e) => handleChange(index, e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={submitting}
          />
        ))}
      </fieldset>

      <p className="fp-modal__resend">
        Didn&apos;t get the OTP?{" "}
        <button
          type="button"
          className="fp-modal__resend-btn"
          onClick={() => void handleResend()}
          disabled={resendSec > 0 || submitting}
        >
          {resendSec > 0 ? `Resend OTP (${resendSec}s)` : "Resend OTP"}
        </button>
      </p>

      <footer className="fp-modal__footer">
        <div className="fp-modal__footer-row">
          <button
            type="button"
            className="fp-modal__btn-primary"
            disabled={!otpComplete || submitting}
            onClick={() => void handleVerify()}
          >
            {submitting ? "…" : "Verify"}
          </button>
        </div>
      </footer>
    </>
  );
}

type ForgotPasswordResetStepProps = Readonly<{
  resetTitleId: string;
  /** Phone digits verified in this flow (fallback if session has no `user.phone`). */
  verifiedPhoneDigits: string;
  onSuccess: () => void;
  onStartOver: () => void;
}>;

function ForgotPasswordResetStep({
  resetTitleId,
  verifiedPhoneDigits,
  onSuccess,
  onStartOver,
}: ForgotPasswordResetStepProps) {
  const newId = useId();
  const confirmId = useId();
  const readonlyPhoneId = useId();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  /** `undefined` = still loading from encrypted session in localStorage */
  const [sessionPhone, setSessionPhone] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!getForgotResetToken()) setTokenMissing(true);
  }, []);

  useEffect(() => {
    getAuthSession()
      .then((s) => {
        const p = s?.user?.phone;
        setSessionPhone(typeof p === "string" && p.trim() ? p.trim() : null);
      })
      .catch(() => {
        setSessionPhone(null);
      });
  }, []);

  const clearErrorOnChange =
    (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      if (banner?.variant === "error") setBanner(null);
      setter(e.target.value);
    };

  const canSubmit =
    !tokenMissing &&
    password.length >= MIN_NEW_PASSWORD_LEN &&
    password === confirmPassword &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const token = getForgotResetToken();
    if (!token) {
      setTokenMissing(true);
      return;
    }
    setSubmitting(true);
    setBanner(null);
    try {
      await resetPatientPassword({
        token,
        password,
        confirmation_password: confirmPassword,
      });
      clearForgotResetToken();
      onSuccess();
    } catch (e) {
      setBanner({
        variant: "error",
        text: e instanceof Error ? e.message : "Could not reset password",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const phoneSource =
    sessionPhone !== undefined && sessionPhone !== null && sessionPhone.length > 0
      ? sessionPhone
      : verifiedPhoneDigits;
  const phoneDigitsForMask = digitsOnly(phoneSource);

  let maskedPhoneDisplay = "—";
  if (sessionPhone === undefined) {
    maskedPhoneDisplay = "…";
  } else if (phoneDigitsForMask.length > 0) {
    maskedPhoneDisplay = maskPhone(phoneDigitsForMask);
  }

  if (tokenMissing) {
    return (
      <>
        <h2 id={resetTitleId} className="fp-modal__title fp-modal__title--solo">
          Set new password
        </h2>
        <div
          className="cp-modal__banner cp-modal__banner--error"
          role="alert"
          aria-live="assertive"
        >
          Reset session expired or missing. Please start again from your mobile number.
        </div>
        <footer className="fp-modal__footer">
          <div className="fp-modal__footer-row">
            <button type="button" className="fp-modal__btn-primary" onClick={onStartOver}>
              Start over
            </button>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <h2 id={resetTitleId} className="fp-modal__title fp-modal__title--solo">
        Set new password
      </h2>
      <p className="fp-modal__subtitle">
        Choose a new password and confirm it. You&apos;ll use this to sign in next time.
      </p>

      {banner ? (
        <div
          className={`cp-modal__banner cp-modal__banner--${banner.variant}`}
          role={banner.variant === "error" ? "alert" : undefined}
          aria-live={banner.variant === "error" ? "assertive" : "polite"}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="cp-field">
        <label className="del-modal__feedback-label" htmlFor={readonlyPhoneId}>
          Mobile number
        </label>
        <input
          id={readonlyPhoneId}
          className="cp-field__input fp-modal__phone-readonly-input"
          type="text"
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          value={maskedPhoneDisplay}
        />
      </div>

      <div className="cp-field">
        <label className="del-modal__feedback-label" htmlFor={newId}>
          New password
        </label>
        <input
          id={newId}
          className="cp-field__input"
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={clearErrorOnChange(setPassword)}
          disabled={submitting}
        />
      </div>

      <div className="cp-field">
        <label className="del-modal__feedback-label" htmlFor={confirmId}>
          Confirm password
        </label>
        <input
          id={confirmId}
          className="cp-field__input"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={clearErrorOnChange(setConfirmPassword)}
          disabled={submitting}
        />
      </div>

      <footer className="fp-modal__footer">
        <div className="fp-modal__footer-row">
          <button
            type="button"
            className="fp-modal__btn-primary"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "…" : "Reset password"}
          </button>
        </div>
      </footer>
    </>
  );
}

type ForgotPasswordModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** After new password is saved via POST /reset (e.g. toast + go to login). */
  onFlowFinished: () => void;
}>;

function forgotDialogLabelId(
  step: "phone" | "otp" | "reset",
  ids: Readonly<{ phone: string; otp: string; reset: string }>,
): string {
  switch (step) {
    case "otp":
      return ids.otp;
    case "reset":
      return ids.reset;
    default:
      return ids.phone;
  }
}

export function ForgotPasswordModal({ open, onClose, onFlowFinished }: ForgotPasswordModalProps) {
  const titleId = useId();
  const otpTitleId = useId();
  const resetTitleId = useId();
  const phoneFieldId = useId();
  const phoneStepHintId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"phone" | "otp" | "reset">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otpSession, setOtpSession] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [sending, setSending] = useState(false);
  /** Digits-only registered phone from session; `undefined` = loading; `null` = missing/invalid */
  const [registeredPhoneDigits, setRegisteredPhoneDigits] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhoneInput("");
      setPhoneDigits("");
      setOtpSession(0);
      setBanner(null);
      setSending(false);
      setRegisteredPhoneDigits(undefined);
      clearForgotResetToken();
    }
  }, [open]);

  /** Load registered phone for hint + match check (do not pre-fill the input). */
  useLayoutEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRegisteredPhoneDigits(undefined);
    getAuthSession()
      .then((s) => {
        if (cancelled) return;
        const p = s?.user?.phone;
        const raw = typeof p === "string" ? digitsOnly(p.trim()) : "";
        setRegisteredPhoneDigits(raw.length >= MIN_PHONE_DIGITS ? raw : null);
      })
      .catch(() => {
        if (!cancelled) setRegisteredPhoneDigits(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const digits = digitsOnly(phoneInput);
  const hasRegisteredPhone =
    registeredPhoneDigits != null && registeredPhoneDigits.length >= MIN_PHONE_DIGITS;
  const phoneMatches = hasRegisteredPhone && digits === registeredPhoneDigits;
  const showPhoneMismatch =
    hasRegisteredPhone && digits.length >= MIN_PHONE_DIGITS && digits !== registeredPhoneDigits;
  const canSendOtp = phoneMatches && !sending;

  const handleSendOtp = async () => {
    if (!canSendOtp) return;
    setBanner(null);
    setSending(true);
    try {
      const fcm_token = await getWebFcmToken();
      await requestForgotOtp({ phone: digits, type: "FORGOT", fcm_token });
      setPhoneDigits(digits);
      setOtpSession((s) => s + 1);
      setStep("otp");
    } catch (e) {
      setBanner({
        variant: "error",
        text: e instanceof Error ? e.message : "Could not send OTP",
      });
    } finally {
      setSending(false);
    }
  };

  const dialogLabelId = forgotDialogLabelId(step, {
    phone: titleId,
    otp: otpTitleId,
    reset: resetTitleId,
  });

  return (
    <dialog
      ref={dialogRef}
      className="profile-modal-dialog"
      aria-labelledby={dialogLabelId}
      onClose={() => onClose()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="profile-modal-panel fp-modal">
        {step === "phone" ? (
          <>
            <h2 id={titleId} className="fp-modal__title fp-modal__title--solo">
              Forgot password
            </h2>
            <p className="fp-modal__subtitle">
              Enter your full registered mobile number below. We&apos;ll send an OTP only if it matches
              your account.
            </p>

            {registeredPhoneDigits === null ? (
              <div
                className="cp-modal__banner cp-modal__banner--error"
                role="alert"
                aria-live="assertive"
              >
                We couldn&apos;t load your registered number. Sign out and sign in again, then try
                forgot password.
              </div>
            ) : null}

            {banner ? (
              <div
                className={`cp-modal__banner cp-modal__banner--${banner.variant}`}
                role={banner.variant === "error" ? "alert" : undefined}
                aria-live={banner.variant === "error" ? "assertive" : "polite"}
              >
                {banner.text}
              </div>
            ) : null}

            <div className="cp-field">
              <div className="fp-modal__label-row">
                <label className="del-modal__feedback-label fp-modal__label-row-label" htmlFor={phoneFieldId}>
                  Mobile number
                </label>
                <ForgotPhoneHint
                  registeredDigits={registeredPhoneDigits}
                  minDigits={MIN_PHONE_DIGITS}
                />
              </div>
              <span id={phoneStepHintId} className="visually-hidden">
                {hasRegisteredPhone
                  ? `Enter your complete ${MIN_PHONE_DIGITS}-digit mobile number. It ends in ${registeredPhoneDigits.slice(-2)}.`
                  : `Enter your ${MIN_PHONE_DIGITS}-digit registered mobile number.`}
              </span>
              <input
                id={phoneFieldId}
                className={`cp-field__input${showPhoneMismatch ? " cp-field__input--invalid" : ""}`}
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Enter mobile number"
                aria-invalid={showPhoneMismatch}
                aria-describedby={phoneStepHintId}
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  if (banner?.variant === "error") setBanner(null);
                }}
              />
              {showPhoneMismatch ? (
                <p className="fp-modal__field-error" role="alert">
                  Incorrect mobile number
                </p>
              ) : null}
            </div>

            <footer className="fp-modal__footer">
              <div className="fp-modal__footer-row">
                <button type="button" className="fp-modal__btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="fp-modal__btn-primary"
                  disabled={!canSendOtp}
                  onClick={() => void handleSendOtp()}
                >
                  {sending ? "…" : "Send OTP"}
                </button>
              </div>
            </footer>
          </>
        ) : null}

        {step === "otp" ? (
          <ForgotPasswordOtpStep
            key={`${phoneDigits}-${otpSession}`}
            otpTitleId={otpTitleId}
            phoneDigits={phoneDigits}
            onBack={() => {
              setStep("phone");
              setBanner(null);
            }}
            onOtpVerified={() => setStep("reset")}
          />
        ) : null}

        {step === "reset" ? (
          <ForgotPasswordResetStep
            resetTitleId={resetTitleId}
            verifiedPhoneDigits={phoneDigits}
            onSuccess={() => {
              onClose();
              onFlowFinished();
            }}
            onStartOver={() => {
              clearForgotResetToken();
              setStep("phone");
            }}
          />
        ) : null}
      </div>
    </dialog>
  );
}
