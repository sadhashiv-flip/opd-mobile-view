import { useId } from "react";
import { LoginFieldValidIcon } from "@/assets/icons/react";
import logoDark from "@/assets/images/logos/logo-dark.png";
import { MIN_LOGIN_PASSWORD_LENGTH } from "@/constants";
import { useLoginPage } from "@/hooks/useLoginPage";
import "./LoginPage.css";

function PasswordVisibilityIcon({ visible }: Readonly<{ visible: boolean }>) {
  if (visible) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M4 4l16 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function LoginPage() {
  const contactId = useId();
  const passwordId = useId();
  const {
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
    labelText,
    isSubmitting,
    otpSubtitle,
  } = useLoginPage();

  return (
    <main className={`page login-page${phoneComplete ? " login-page--filled" : ""}`}>
      <div className="login-page__body">
        <div className="login-page__spacer">
          <div className="login-page__brand">
            <img
              className="login-page__logo"
              src={logoDark}
              alt="OPD Mobile"
              decoding="async"
            />
          </div>
          <header className="login-page__header">
            <h1 className="login-page__title">Log in with mobile number</h1>
            <p className="login-page__subtitle">
              {usePasswordLogin
                ? "Enter your password to continue"
                : otpSubtitle}
            </p>
          </header>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor={contactId}>
              {labelText}
            </label>
            <div
              className={`login-page__input-wrap${phoneComplete ? " login-page__input-wrap--valid" : ""}`}
            >
              <input
                id={contactId}
                className={`login-page__input${phoneComplete ? " login-page__input--valid" : ""}`}
                type="text"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="10-digit mobile"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
              {phoneComplete ? (
                <span className="login-page__valid-icon" aria-hidden="true">
                  <LoginFieldValidIcon />
                </span>
              ) : null}
            </div>
          </div>

          {/* <div className="login-page__mode-row">
            <button
              type="button"
              className="login-page__mode-toggle"
              onClick={() => setUsePasswordLogin(!usePasswordLogin)}
            >
              {usePasswordLogin ? "Use OTP instead" : "Log in with password"}
            </button>
          </div> */}

          {usePasswordLogin ? (
            <div className="login-page__field login-page__field--password">
              <label className="login-page__label" htmlFor={passwordId}>
                Password
              </label>
              <div className="login-page__input-wrap login-page__input-wrap--password">
                <input
                  id={passwordId}
                  className="login-page__input login-page__input--password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={`At least ${MIN_LOGIN_PASSWORD_LENGTH} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-page__password-toggle"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                >
                  <PasswordVisibilityIcon visible={passwordVisible} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="login-page__footer">
          <label className="login-page__consent">
            <input
              className={`login-page__checkbox${phoneComplete ? " login-page__checkbox--orange" : ""}`}
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className="login-page__consent-text">
              Click here to accept{" "}
              <a href="#terms" className="login-page__link">
                terms and conditions
              </a>
            </span>
          </label>
          <button
            type="button"
            className="login-page__confirm"
            disabled={isSubmitting || !canProceed}
            onClick={() => void handleConfirm()}
          >
            {isSubmitting ? "Please wait…" : "Confirm"}
          </button>
        </footer>
      </div>
    </main>
  );
}
