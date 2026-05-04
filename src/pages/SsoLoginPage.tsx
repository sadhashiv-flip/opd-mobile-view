import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoDark from "@/assets/images/logos/logo-dark.png";
import { ROUTES } from "@/constants";
import { exchangeSsoToken, shouldUseSsoMock } from "@/lib/sso/exchangeSsoToken";
import { completeAuthAndNavigate } from "@/lib/postVerifyNavigation";
import { saveAuthSession } from "@/lib/authStorage";
import "./SsoLoginPage.css";

type Phase = "loading" | "error";

function SsoSpinner() {
  return (
    <div className="sso-login-page__spinner-wrap" aria-hidden>
      <div className="sso-login-page__spinner" />
    </div>
  );
}

function SsoErrorIllustration() {
  return (
    <div className="sso-login-page__error-icon" aria-hidden>
      <svg
        className="sso-login-page__error-svg"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="40"
          cy="40"
          r="36"
          stroke="url(#sso-err-grad)"
          strokeWidth="3"
          fill="color-mix(in srgb, var(--color-brand-orange) 8%, #ffffff)"
        />
        <path
          d="M40 24v24M40 56h.02"
          stroke="var(--color-brand-orange)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="sso-err-grad" x1="8" y1="12" x2="72" y2="68">
            <stop stopColor="var(--color-brand-orange)" />
            <stop offset="1" stopColor="#ffb399" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/**
 * Provider entry for IAM redirect: `/sso-login?token=…`
 * Strips the token from the URL, exchanges for a session, then uses the same post-verify
 * flow as OTP / password login.
 */
export function SsoLoginPage() {
  const navigate = useNavigate();
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    const sp = new URLSearchParams(globalThis.location.search);
    const token = sp.get("token")?.trim() ?? "";
    if (!token) {
      ranRef.current = true;
      setPhase("error");
      setMessage("Missing token. Open this page from the SSO redirect link with ?token=…");
      return;
    }
    ranRef.current = true;
    try {
      globalThis.history.replaceState(null, "", ROUTES.ssoLogin);
    } catch {
      /* ignore */
    }

    void (async () => {
      try {
        const data = await exchangeSsoToken(token);
        await saveAuthSession(data);
        await completeAuthAndNavigate(navigate, data);
      } catch (e) {
        setPhase("error");
        setMessage(
          e instanceof Error
            ? e.message
            : "Sign-in failed. Try again or use the regular login page.",
        );
      }
    })();
  }, [navigate]);

  if (phase === "error" && message) {
    return (
      <main className="page sso-login-page">
        <div className="sso-login-page__body">
          <div className="sso-login-page__brand">
            <img
              className="sso-login-page__logo"
              src={logoDark}
              alt="OPD Mobile"
              decoding="async"
            />
          </div>
          <div className="sso-login-page__panel">
            <SsoErrorIllustration />
            <header className="sso-login-page__header">
              <h1 id={titleId} className="sso-login-page__title">
                Couldn’t complete sign-in
              </h1>
              <p className="sso-login-page__message">{message}</p>
            </header>
            {shouldUseSsoMock() ? (
              <div className="sso-login-page__mock-banner" role="note">
                <span className="sso-login-page__mock-label">Dev · mock SSO</span>
                <p className="sso-login-page__mock-text">
                  Try{" "}
                  <code className="sso-login-page__code">/sso-login?token=demo</code>
                </p>
              </div>
            ) : null}
            <div className="sso-login-page__actions">
              <Link className="sso-login-page__cta" to={ROUTES.login} replace>
                Back to login
              </Link>
              <p className="sso-login-page__footer-hint">
                If this keeps happening, use mobile or email login or contact support.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="page sso-login-page"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby={titleId}
    >
      <div className="sso-login-page__body sso-login-page__body--loading">
        <div className="sso-login-page__brand">
          <img
            className="sso-login-page__logo"
            src={logoDark}
            alt="OPD Mobile"
            decoding="async"
          />
        </div>
        <div className="sso-login-page__panel sso-login-page__panel--loading">
          <SsoSpinner />
          <header className="sso-login-page__header sso-login-page__header--center">
            <h1 id={titleId} className="sso-login-page__title">
              Signing you in
            </h1>
            <p className="sso-login-page__subtitle">
              Secure connection through single sign-on…
            </p>
          </header>
          {shouldUseSsoMock() ? (
            <div className="sso-login-page__mock-pill" role="note">
              Mock mode · no API exchange
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
