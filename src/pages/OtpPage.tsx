import { useOtpPage } from "@/hooks/useOtpPage";
import "./OtpPage.css";

export function OtpPage() {
  const {
    phone,
    digits,
    inputsRef,
    otpComplete,
    handlePaste,
    handleChange,
    handleKeyDown,
    handleResend,
    handleEdit,
    handleConfirm,
    slotKeys,
    otpLen,
  } = useOtpPage();

  return (
    <main className="page otp-page">
      <div className="otp-page__body">
        <div className="otp-page__spacer">
          <h1 className="otp-page__title">Enter OTP</h1>
          <p className="otp-page__subtitle">
            An OTP has been sent to the below mobile number
          </p>
          <div className="otp-page__top">
            <div className="otp-page__phone-block">
              <div className="otp-page__phone-row">
                <span className="otp-page__phone">{phone}</span>
                <button
                  type="button"
                  className="otp-page__edit"
                  onClick={handleEdit}
                >
                  edit
                </button>
              </div>
            </div>
          </div>

          <fieldset className="otp-page__digits">
            <legend className="visually-hidden">
              Enter {otpLen}-digit OTP
            </legend>
            {slotKeys.map((slotKey, index) => (
              <input
                key={slotKey}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                className="otp-page__digit"
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

          <p className="otp-page__resend">
            Didn&apos;t get the OTP?{" "}
            <button
              type="button"
              className="otp-page__resend-btn"
              onClick={handleResend}
            >
              Resend
            </button>
          </p>
        </div>

        <footer className="otp-page__footer">
          <button
            type="button"
            className="otp-page__confirm"
            disabled={!otpComplete}
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </footer>
      </div>
    </main>
  );
}
