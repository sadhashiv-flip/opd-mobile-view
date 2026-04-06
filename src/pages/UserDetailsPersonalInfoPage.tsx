import { useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { getAuthSession } from "@/lib/authStorage";
import { useToast } from "@/hooks/useToast";
import type { AuthUser } from "@/types/authSession";
import type { UserDetailsPersonalLocationState } from "@/types/navigation";
import "./UserDetailsFlow.css";

type YesNo = "yes" | "no";
type Gender = "male" | "female" | "other";

function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const monthDelta = now.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d.getDate())) {
    years -= 1;
  }
  if (!Number.isFinite(years) || years < 0 || years > 130) return null;
  return years;
}

function normalizeYesNo(v: string | null): YesNo | null {
  const s = v?.trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "1" || s === "true") return "yes";
  if (s === "no" || s === "n" || s === "0" || s === "false") return "no";
  return null;
}

function deriveFullName(u: AuthUser): string {
  const combined = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return combined || u.name || "";
}

export function UserDetailsPersonalInfoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = (location.state as UserDetailsPersonalLocationState | null) ?? null;

  const fullNameId = useId();
  const dobId = useId();
  const languageId = useId();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [fullName, setFullName] = useState(state?.fullName ?? "");
  const [dob, setDob] = useState(state?.dob ?? "");
  const [language, setLanguage] = useState(state?.language ?? "");
  const [isDiabetic, setIsDiabetic] = useState<YesNo | null>(
    state?.isDiabetic ?? null,
  );
  const [isBloodPressure, setIsBloodPressure] = useState<YesNo | null>(
    state?.isBloodPressure ?? null,
  );

  const [gender, setGender] = useState<Gender>(
    state?.gender ?? "male",
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAuthSession()
      .then((s) => {
        if (cancelled) return;
        const u = s?.user ?? null;
        setUser(u);
        if (!u) return;

        if (!state?.fullName) setFullName((prev) => prev || deriveFullName(u));
        if (!state?.dob) setDob((prev) => prev || (u.dob ?? ""));
        if (!state?.language) setLanguage((prev) => prev || (u.language ?? ""));
        if (!state?.isDiabetic) {
          setIsDiabetic((prev) => prev ?? normalizeYesNo(u.isDiabetic));
        }
        if (!state?.isBloodPressure) {
          setIsBloodPressure((prev) => prev ?? normalizeYesNo(u.isBloodPressure));
        }
        if (!state?.gender) {
          const g = u.gender?.trim().toLowerCase();
          if (g === "male" || g === "female") setGender(g);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProceed = useMemo(() => {
    return (
      fullName.trim().length > 0 &&
      dob.trim().length > 0 &&
      language.trim().length > 0 &&
      isDiabetic !== null &&
      isBloodPressure !== null
    );
  }, [dob, fullName, isBloodPressure, isDiabetic, language]);

  if (loading) {
    return (
      <main className="ud-flow-page">
        <header className="ud-flow-header">
          <button
            type="button"
            className="ud-flow-back"
            onClick={() => navigate(ROUTES.login, { replace: true })}
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="ud-flow-title">User Details</h1>
        </header>
        <div className="ud-flow-loading">Loading…</div>
      </main>
    );
  }

  if (!user) {
    toast.error("Session missing. Please log in again.");
    navigate(ROUTES.login, { replace: true });
    return null;
  }

  return (
    <main className="ud-flow-page">
      <header className="ud-flow-header">
        <button
          type="button"
          className="ud-flow-back"
          onClick={() => navigate(ROUTES.login, { replace: true })}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="ud-flow-title">User Details</h1>
      </header>

      <div className="ud-stepper">
        <div className="ud-step ud-step--active">
          <span className="ud-step__index">1</span>
          <span className="ud-step__label">Personal Info</span>
        </div>
        <div className="ud-step">
          <span className="ud-step__index ud-step__index--ghost">2</span>
          <span className="ud-step__label ud-step__label--muted">BMI Score</span>
        </div>
      </div>

      <section className="ud-card">
        <h2 className="ud-card__title">Personal Information</h2>
        <p className="ud-card__subtitle">
          We need some basic details to calculate your health score
        </p>

        <div className="ud-field">
          <label className="ud-field__label" htmlFor={fullNameId}>
            Full Name <span className="ud-field__required">*</span>
          </label>
          <input
            id={fullNameId}
            className="ud-field__input"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            autoComplete="name"
          />
        </div>

        <div className="ud-field">
          <label className="ud-field__label" htmlFor={dobId}>
            Date of Birth <span className="ud-field__required">*</span>
          </label>
          <input
            id={dobId}
            className="ud-field__input"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>

        <div className="ud-field">
          <label className="ud-field__label" htmlFor={languageId}>
            Preferred Language <span className="ud-field__required">*</span>
          </label>
          <select
            id={languageId}
            className="ud-field__input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Preferred language"
          >
            <option value="" disabled>
              Select language
            </option>
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="telugu">Telugu</option>
            <option value="tamil">Tamil</option>
            <option value="kannada">Kannada</option>
            <option value="marathi">Marathi</option>
            <option value="malayalam">Malayalam</option>
            <option value="gujarathi">Gujarathi</option>
          </select>
        </div>

        <div className="ud-field ud-field--row">
          <div className="ud-field__label">
            Are you Diabetic? <span className="ud-field__required">*</span>
          </div>
          <div className="ud-toggle">
            <button
              type="button"
              className={`ud-toggle__btn${isDiabetic === "yes" ? " ud-toggle__btn--active" : ""}`}
              onClick={() => setIsDiabetic("yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className={`ud-toggle__btn${isDiabetic === "no" ? " ud-toggle__btn--active" : ""}`}
              onClick={() => setIsDiabetic("no")}
            >
              No
            </button>
          </div>
        </div>

        <div className="ud-field ud-field--row">
          <div className="ud-field__label">
            Do you have Blood Pressure? <span className="ud-field__required">*</span>
          </div>
          <div className="ud-toggle">
            <button
              type="button"
              className={`ud-toggle__btn${isBloodPressure === "yes" ? " ud-toggle__btn--active" : ""}`}
              onClick={() => setIsBloodPressure("yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className={`ud-toggle__btn${isBloodPressure === "no" ? " ud-toggle__btn--active" : ""}`}
              onClick={() => setIsBloodPressure("no")}
            >
              No
            </button>
          </div>
        </div>

        <p className="ud-info">
          Your personal data is secure and will only be used to calculate your health score.
        </p>

        <button
          type="button"
          className="ud-primary"
          disabled={!canProceed}
          onClick={() => {
            if (!canProceed) return;
            const derivedAge = ageFromDob(dob.trim());
            navigate(ROUTES.userDetailsBmi, {
              state: {
                fullName: fullName.trim(),
                dob: dob.trim(),
                language: language.trim(),
                isDiabetic: isDiabetic ?? undefined,
                isBloodPressure: isBloodPressure ?? undefined,
                gender,
                age: derivedAge,
              } satisfies UserDetailsPersonalLocationState,
            });
          }}
        >
          Save &amp; Proceed <span aria-hidden>→</span>
        </button>
      </section>
    </main>
  );
}

