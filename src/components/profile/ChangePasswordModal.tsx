import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import "./ProfileAccountModals.css";

const MIN_NEW_LEN = 6;

const DEFAULT_FORGOT_HINT =
  "Forgot password: use your registered email or contact support when recovery is enabled.";

type InlineBanner =
  | Readonly<{ variant: "error"; text: string }>
  | Readonly<{ variant: "success"; text: string }>
  | Readonly<{ variant: "info"; text: string }>;

type ChangePasswordModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Opens forgot-password flow (phone + OTP). If unset, shows inline hint instead. */
  onForgotExternalFlow?: () => void;
  /** Shown inside the modal when user taps “Forgot password” (only if `onForgotExternalFlow` is unset). */
  forgotPasswordHint?: string;
  onForgotPassword?: () => void;
  onSubmit?: (payload: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void | Promise<void>;
}>;

export function ChangePasswordModal({
  open,
  onClose,
  onForgotExternalFlow,
  forgotPasswordHint = DEFAULT_FORGOT_HINT,
  onForgotPassword,
  onSubmit,
}: ChangePasswordModalProps) {
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<InlineBanner | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBanner = () => setBanner(null);

  useEffect(() => {
    if (!open) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSubmitting(false);
      setBanner(null);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }
  }, [open]);

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
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!open) return null;

  const successLock = banner?.variant === "success";

  const canSubmit =
    !successLock &&
    oldPassword.length > 0 &&
    newPassword.length >= MIN_NEW_LEN &&
    newPassword === confirmPassword &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    clearBanner();
    try {
      await onSubmit?.({ oldPassword, newPassword, confirmPassword });
      setBanner({ variant: "success", text: "Password updated successfully." });
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        onClose();
      }, 1800);
    } catch (e) {
      setBanner({
        variant: "error",
        text: e instanceof Error ? e.message : "Could not update password",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = () => {
    if (onForgotExternalFlow) {
      onForgotExternalFlow();
      return;
    }
    onForgotPassword?.();
    setBanner({ variant: "info", text: forgotPasswordHint });
  };

  const onFieldChange = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    if (banner?.variant === "error") clearBanner();
    setter(e.target.value);
  };

  return (
    <dialog
      ref={dialogRef}
      className="profile-modal-dialog"
      aria-labelledby={`${baseId}-cp-title`}
      onClose={() => onClose()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="profile-modal-panel cp-modal">
        <h2 id={`${baseId}-cp-title`} className="cp-modal__title">
          Change Password
        </h2>
        <p className="cp-modal__subtitle">This new password used for login</p>

        {banner ? (
          <div
            className={`cp-modal__banner cp-modal__banner--${banner.variant}`}
            role={banner.variant === "error" ? "alert" : undefined}
            aria-live={banner.variant === "error" ? "assertive" : "polite"}
          >
            {banner.text}
          </div>
        ) : null}

        <div className="cp-outline">
          <input
            id={`${baseId}-old`}
            className="cp-outline__input"
            type="password"
            autoComplete="current-password"
            placeholder=" "
            value={oldPassword}
            onChange={onFieldChange(setOldPassword)}
            disabled={successLock}
          />
          <label className="cp-outline__label" htmlFor={`${baseId}-old`}>
            Old password
          </label>
        </div>

        <div className="cp-modal__forgot-wrap">
          <button
            type="button"
            className="cp-modal__forgot"
            onClick={handleForgot}
            disabled={successLock}
          >
            Forgot Password? Click Here
          </button>
        </div>

        <div className="cp-field">
          <input
            id={`${baseId}-new`}
            className="cp-field__input"
            type="password"
            autoComplete="new-password"
            placeholder="New Password"
            value={newPassword}
            onChange={onFieldChange(setNewPassword)}
            disabled={successLock}
          />
        </div>

        <div className="cp-field">
          <input
            id={`${baseId}-confirm`}
            className="cp-field__input"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={onFieldChange(setConfirmPassword)}
            disabled={successLock}
          />
        </div>

        <footer className="cp-modal__footer">
          <button
            type="button"
            className="cp-modal__submit"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "…" : "Submit"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
