import { useId } from "react";
import { LoginFieldValidIcon } from "@/assets/icons/react";
import { useLoginPage } from "@/hooks/useLoginPage";
import "./LoginPage.css";

export function LoginPage() {
  const fieldId = useId();
  const {
    filled,
    contact,
    setContact,
    accepted,
    setAccepted,
    canProceed,
    handleConfirm,
    labelText,
  } = useLoginPage();

  return (
    <main
      className={`page login-page${filled ? " login-page--filled" : ""}`}
    >
      <div className="login-page__body">
        <div className="login-page__spacer">
          <header className="login-page__header">
            <h1 className="login-page__title">
              Enter Mobile/Email to Login/Signup
            </h1>
            <p className="login-page__subtitle">You will receive an OTP</p>
          </header>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor={fieldId}>
              {labelText}
            </label>
            <div
              className={`login-page__input-wrap${filled ? " login-page__input-wrap--valid" : ""}`}
            >
              <input
                id={fieldId}
                className={`login-page__input${filled ? " login-page__input--valid" : ""}`}
                type="text"
                inputMode={filled ? "numeric" : "text"}
                autoComplete="username"
                placeholder=""
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
              {filled && (
                <span className="login-page__valid-icon" aria-hidden="true">
                  <LoginFieldValidIcon />
                </span>
              )}
            </div>
          </div>
        </div>

        <footer className="login-page__footer">
          <label className="login-page__consent">
            <input
              className={`login-page__checkbox${filled ? " login-page__checkbox--orange" : ""}`}
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
            disabled={!filled && !canProceed}
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </footer>
      </div>
    </main>
  );
}
