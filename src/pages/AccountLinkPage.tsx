import { Navigate } from "react-router-dom";
import logoDark from "@/assets/images/logos/logo-dark.png";
import { ROUTES } from "@/constants";
import { useAccountLinkPage } from "@/hooks/useAccountLinkPage";
import "./AccountLinkPage.css";

export function AccountLinkPage() {
  const page = useAccountLinkPage();

  if (page.kind === "invalid") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const {
    linkKind,
    step,
    rawInput,
    setRawInput,
    valueValid,
    handleSendOtp,
    sending,
    linkValue,
    handleEditValue,
    handleResend,
    handleConfirm,
    isSubmitting,
    digits,
    inputsRef,
    otpComplete,
    handlePaste,
    handleChange,
    handleKeyDown,
    slotKeys,
    otpLen,
  } = page;

  const title =
    linkKind === "PHONE" ? "Link your phone" : "Link your email";
  const subtitle =
    linkKind === "PHONE"
      ? "Enter your mobile number. We will send an OTP to verify it."
      : "Enter your email address. We will send an OTP to verify it.";

  return (
    <main className="page account-link-page">
      <div className="account-link-page__body">
        <div className="account-link-page__spacer">
          <div className="account-link-page__brand">
            <img
              className="account-link-page__logo"
              src={logoDark}
              alt="OPD Mobile"
              decoding="async"
            />
          </div>
          <h1 className="account-link-page__title">{title}</h1>
          <p className="account-link-page__subtitle">{subtitle}</p>

          {step === "value" ? (
            <div className="account-link-page__field">
              <label className="account-link-page__label" htmlFor="account-link-value">
                {linkKind === "PHONE" ? "Mobile number" : "Email"}
              </label>
              <input
                id="account-link-value"
                className="account-link-page__input"
                type={linkKind === "PHONE" ? "tel" : "email"}
                inputMode={linkKind === "PHONE" ? "numeric" : "email"}
                autoComplete={linkKind === "PHONE" ? "tel" : "email"}
                maxLength={linkKind === "PHONE" ? 10 : undefined}
                placeholder={
                  linkKind === "PHONE" ? "10-digit mobile" : "name@example.com"
                }
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="account-link-page__top">
                <div className="account-link-page__value-row">
                  <span className="account-link-page__value">{linkValue}</span>
                  <button
                    type="button"
                    className="account-link-page__edit"
                    onClick={handleEditValue}
                  >
                    edit
                  </button>
                </div>
              </div>
              <fieldset className="account-link-page__digits">
                <legend className="visually-hidden">
                  Enter {otpLen}-digit OTP
                </legend>
                {slotKeys.map((slotKey, index) => (
                  <input
                    key={slotKey}
                    ref={(el) => {
                      inputsRef.current[index] = el;
                    }}
                    className="account-link-page__digit"
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    aria-label={`Digit ${index + 1} of ${otpLen}`}
                    value={digits[index]}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                  />
                ))}
              </fieldset>
              <p className="account-link-page__resend">
                Didn&apos;t get the OTP?{" "}
                <button
                  type="button"
                  className="account-link-page__resend-btn"
                  onClick={() => void handleResend()}
                >
                  Resend
                </button>
              </p>
            </>
          )}
        </div>

        <footer className="account-link-page__footer">
          {step === "value" ? (
            <button
              type="button"
              className="account-link-page__confirm"
              disabled={!valueValid || sending}
              onClick={() => void handleSendOtp()}
            >
              {sending ? "Please wait…" : "Send OTP"}
            </button>
          ) : (
            <button
              type="button"
              className="account-link-page__confirm"
              disabled={!otpComplete || isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? "Please wait…" : "Confirm"}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
