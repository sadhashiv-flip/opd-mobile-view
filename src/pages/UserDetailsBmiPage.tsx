import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { calculatePatientBmi } from "@/api/patientHealthScore";
import { submitPatientParameter } from "@/api/patientParameters";
import { ROUTES } from "@/constants";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { useToast } from "@/hooks/useToast";
import {
  buildDigitalDiaryBmiSubmitPayload,
  computeBmiFromMetrics,
} from "@/lib/digitalDiary";
import { getAuthSession } from "@/lib/authStorage";
import { loadCachedProfileRaw } from "@/lib/profileCacheStorage";
import type {
  UserDetailsBmiLocationState,
  UserDetailsBmiResultLocationState,
} from "@/types/navigation";
import "./UserDetailsFlow.css";

function ageFromDob(dob: string | undefined): number | null {
  if (!dob) return null;
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

function cmToFeet(cm: number): number {
  return cm / 30.48;
}

function feetToCm(feet: number): number {
  return feet * 30.48;
}

function kgToLbs(kg: number): number {
  return kg * 2.2046226218;
}

function lbsToKg(lbs: number): number {
  return lbs / 2.2046226218;
}

function IconMale({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="10" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 4h4v4M20 4l-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFemale({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 14v7M9 18h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 11V8a4 4 0 118 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeGender(v: unknown): "male" | "female" | "other" | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "male" || s === "female" || s === "other") return s;
  return null;
}

function normalizeYesNo(v: unknown): "yes" | "no" | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "yes" || s === "y" || s === "1" || s === "true") return "yes";
  if (s === "no" || s === "n" || s === "0" || s === "false") return "no";
  return null;
}

function profilePrefillFromRaw(body: unknown): UserDetailsBmiLocationState {
  const root = asRecord(body) ?? {};
  const pickUser =
    asRecord(root.user) ??
    asRecord(root.profile) ??
    asRecord(root.data) ??
    root;
  const health =
    asRecord(pickUser.health_score) ?? asRecord(pickUser.healthScore);
  const details = health ? asRecord(health.details) : null;

  const first = typeof pickUser.first_name === "string" ? pickUser.first_name : "";
  const last = typeof pickUser.last_name === "string" ? pickUser.last_name : "";
  const combined = `${first} ${last}`.trim();
  const fullName =
    (typeof pickUser.name === "string" && pickUser.name.trim()) || combined || undefined;

  const heightCm = details ? coerceNumber(details.height) : null;
  const weightKg = details ? coerceNumber(details.weight) : null;

  return {
    fullName,
    dob: typeof pickUser.dob === "string" ? pickUser.dob : undefined,
    language: typeof pickUser.language === "string" ? pickUser.language : undefined,
    gender: normalizeGender(pickUser.gender) ?? undefined,
    isDiabetic: normalizeYesNo(pickUser.isDiabetic) ?? undefined,
    isBloodPressure: normalizeYesNo(pickUser.isBloodPressure) ?? undefined,
    heightCm: heightCm != null && heightCm > 0 ? heightCm : undefined,
    weightKg: weightKg != null && weightKg > 0 ? weightKg : undefined,
  };
}

export function UserDetailsBmiPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = (location.state as UserDetailsBmiLocationState | null) ?? null;
  const startFromBmi = state?.startFromBmi === true;
  const returnPath = state?.returnPath ?? ROUTES.digitalDiary;

  const [gender, setGender] = useState<"male" | "female" | "other">(
    state?.gender ?? "male",
  );
  const [genderLocked, setGenderLocked] = useState(false);
  const [dob, setDob] = useState(state?.dob ?? "");
  const age = useMemo(() => ageFromDob(dob), [dob]);
  const [heightCm, setHeightCm] = useState(state?.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState(state?.weightKg ?? 70);
  const [heightUnit, setHeightUnit] = useState<"cm" | "feet">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [submitting, setSubmitting] = useState(false);
  const [prefillReady, setPrefillReady] = useState(!startFromBmi);

  const isDiabetic = state?.isDiabetic ?? "no";
  const isBloodPressure = state?.isBloodPressure ?? "no";

  useEffect(() => {
    if (!startFromBmi) return;
    let cancelled = false;

    (async () => {
      const session = await getAuthSession();
      const cached = loadCachedProfileRaw();
      const fromProfile = profilePrefillFromRaw(cached);
      const u = session?.user;

      const nextGender =
        fromProfile.gender ??
        (u?.gender === "male" || u?.gender === "female" || u?.gender === "other"
          ? u.gender
          : "male");
      const nextDob = fromProfile.dob ?? u?.dob ?? "";
      const nextHeight =
        fromProfile.heightCm != null && fromProfile.heightCm > 0
          ? fromProfile.heightCm
          : 170;
      const nextWeight =
        fromProfile.weightKg != null && fromProfile.weightKg > 0
          ? fromProfile.weightKg
          : 70;
      const locked = normalizeGender(fromProfile.gender ?? u?.gender) != null;

      if (cancelled) return;
      setGender(nextGender);
      setGenderLocked(locked);
      setDob(nextDob);
      setHeightCm(nextHeight);
      setWeightKg(nextWeight);
      setPrefillReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [startFromBmi]);

  const canCalculate = useMemo(() => {
    return prefillReady && heightCm > 0 && weightKg > 0 && !submitting;
  }, [heightCm, prefillReady, submitting, weightKg]);

  const displayedHeight = useMemo(() => {
    if (heightUnit === "cm") return Math.round(heightCm);
    return Number(cmToFeet(heightCm).toFixed(1));
  }, [heightCm, heightUnit]);

  const displayedWeight = useMemo(() => {
    if (weightUnit === "kg") return Math.round(weightKg);
    return Number(kgToLbs(weightKg).toFixed(1));
  }, [weightKg, weightUnit]);

  const heightRange = useMemo(() => {
    if (heightUnit === "cm") {
      return { min: 0, max: 300, step: 1 };
    }
    return { min: 0, max: 10, step: 0.01 };
  }, [heightUnit]);

  const weightRange = useMemo(() => {
    if (weightUnit === "kg") {
      return { min: 0, max: 300, step: 1 };
    }
    return { min: 0, max: 660, step: 0.1 };
  }, [weightUnit]);

  const handleBack = () => {
    if (startFromBmi) {
      navigate(returnPath);
      return;
    }
    navigate(ROUTES.userDetailsPersonal, { replace: true, state });
  };

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setSubmitting(true);
    try {
      if (startFromBmi) {
        await submitPatientParameter(
          buildDigitalDiaryBmiSubmitPayload(heightCm, weightKg),
        );
        const bmi = computeBmiFromMetrics(heightCm, weightKg);
        const payload: UserDetailsBmiResultLocationState = {
          bmi,
          heightCm,
          weightKg,
          nutritionSuggestion: bmi >= 25,
          returnPath,
        };
        toast.success(DIGITAL_DIARY_COPY.submitSuccess);
        navigate(ROUTES.userDetailsBmiResult, { replace: true, state: payload });
        return;
      }

      const res = await calculatePatientBmi({
        name: state?.fullName ?? "",
        gender,
        dob: state?.dob ?? "",
        height: cmToFeet(heightCm).toFixed(2),
        weight: weightKg,
        isDiabetic: isDiabetic === "yes" ? "yes" : "no",
        language: state?.language ?? "",
        isBloodPressure: isBloodPressure === "yes" ? "yes" : "no",
      });
      const rawHeight = Number(res.health_score.height);
      let resultHeightCm = 0;
      if (Number.isFinite(rawHeight) && rawHeight > 0) {
        resultHeightCm = rawHeight <= 10 ? feetToCm(rawHeight) : rawHeight;
      }
      const payload: UserDetailsBmiResultLocationState = {
        bmi: res.health_score.bmi,
        heightCm: resultHeightCm,
        weightKg: Number(res.health_score.weight),
        nutritionSuggestion: Boolean(res.health_score.nutrition_suggestion),
        message: res.message,
      };
      navigate(ROUTES.userDetailsBmiResult, { replace: true, state: payload });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : startFromBmi
            ? DIGITAL_DIARY_COPY.submitError
            : "Could not calculate BMI",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle = startFromBmi ? DIGITAL_DIARY_COPY.appBarTitle : "User Details";

  return (
    <main className="ud-flow-page">
      <header className="ud-flow-header">
        <button
          type="button"
          className="app-back-btn ud-flow-back"
          onClick={handleBack}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="ud-flow-title">{pageTitle}</h1>
      </header>

      {!startFromBmi ? (
        <div className="ud-stepper">
          <div className="ud-step">
            <span className="ud-step__index ud-step__index--done">✓</span>
            <span className="ud-step__label">Personal Info</span>
          </div>
          <div className="ud-step ud-step--active">
            <span className="ud-step__index">2</span>
            <span className="ud-step__label">BMI Score</span>
          </div>
        </div>
      ) : (
        <div className="ud-stepper">
          <div className="ud-step ud-step--active">
            <span className="ud-step__index">1</span>
            <span className="ud-step__label">Height &amp; Weight</span>
          </div>
        </div>
      )}

      <section className="ud-card">
        <div className="ud-field ud-field--gender">
          <div className="ud-field__label-row">
            <span className="ud-field__label">Gender</span>
            {genderLocked ? (
              <span className="ud-gender-lock-hint">
                <IconLock className="ud-gender-lock-hint__ic" />
                From profile
              </span>
            ) : (
              <span className="ud-gender-hint">Select one</span>
            )}
          </div>
          <div
            className={`ud-gender-segment${genderLocked ? " ud-gender-segment--locked" : ""}`}
            role="radiogroup"
            aria-label="Gender"
          >
            <button
              type="button"
              role="radio"
              aria-checked={gender === "male"}
              className={`ud-gender-tab${gender === "male" ? " ud-gender-tab--active" : ""}`}
              onClick={() => !genderLocked && setGender("male")}
              disabled={genderLocked}
            >
              <IconMale className="ud-gender-tab__icon" />
              <span className="ud-gender-tab__label">Male</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={gender === "female"}
              className={`ud-gender-tab${gender === "female" ? " ud-gender-tab--active" : ""}`}
              onClick={() => !genderLocked && setGender("female")}
              disabled={genderLocked}
            >
              <IconFemale className="ud-gender-tab__icon" />
              <span className="ud-gender-tab__label">Female</span>
            </button>
          </div>
        </div>

        <div className="ud-field ud-field--age">
          <div className="ud-age-pill">
            <span className="ud-age-pill__label">Age</span>
            <span className="ud-age-pill__value">
              {typeof age === "number" && Number.isFinite(age) ? `${age} years` : "—"}
            </span>
            <span className="ud-age-pill__hint">From DOB</span>
          </div>
        </div>

        <div className="ud-slider">
          <div className="ud-slider__header">
            <h2 className="ud-slider__title">{`Height(${heightUnit})`}</h2>
            <div className="ud-units">
              <button
                type="button"
                className={`ud-unit${heightUnit === "cm" ? " ud-unit--active" : ""}`}
                onClick={() => setHeightUnit("cm")}
              >
                cm
              </button>
              <button
                type="button"
                className={`ud-unit${heightUnit === "feet" ? " ud-unit--active" : ""}`}
                onClick={() => setHeightUnit("feet")}
              >
                feet
              </button>
            </div>
          </div>
          <div className="ud-slider__value">
            {heightUnit === "cm" ? `${displayedHeight} cm` : `${displayedHeight} ft`}
          </div>
          <input
            className="ud-slider__range"
            type="range"
            min={heightRange.min}
            max={heightRange.max}
            step={heightRange.step}
            value={heightUnit === "cm" ? heightCm : cmToFeet(heightCm)}
            onChange={(e) => {
              const next = Number(e.target.value);
              setHeightCm(heightUnit === "cm" ? next : feetToCm(next));
            }}
          />
          <div className="ud-slider__minmax">
            <span>{heightRange.min}</span>
            <span>{heightRange.max}</span>
          </div>
        </div>

        <div className="ud-slider">
          <div className="ud-slider__header">
            <h2 className="ud-slider__title">{`Weight(${weightUnit})`}</h2>
            <div className="ud-units">
              <button
                type="button"
                className={`ud-unit${weightUnit === "kg" ? " ud-unit--active" : ""}`}
                onClick={() => setWeightUnit("kg")}
              >
                kg
              </button>
              <button
                type="button"
                className={`ud-unit${weightUnit === "lbs" ? " ud-unit--active" : ""}`}
                onClick={() => setWeightUnit("lbs")}
              >
                lbs
              </button>
            </div>
          </div>
          <div className="ud-slider__value">
            {weightUnit === "kg" ? displayedWeight : displayedWeight.toFixed(1)}
          </div>
          <input
            className="ud-slider__range"
            type="range"
            min={weightRange.min}
            max={weightRange.max}
            step={weightRange.step}
            value={weightUnit === "kg" ? weightKg : kgToLbs(weightKg)}
            onChange={(e) => {
              const next = Number(e.target.value);
              setWeightKg(weightUnit === "kg" ? next : lbsToKg(next));
            }}
          />
          <div className="ud-slider__minmax">
            <span>{weightRange.min}</span>
            <span>{weightRange.max}</span>
          </div>
        </div>

        <button
          type="button"
          className="ud-primary ud-primary--wide"
          disabled={!canCalculate}
          onClick={() => void handleCalculate()}
        >
          {submitting ? "Please wait…" : "Calculate BMI"}
        </button>
      </section>
    </main>
  );
}
