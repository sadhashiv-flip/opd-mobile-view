import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { calculatePatientBmi } from "@/api/patientHealthScore";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import type {
  UserDetailsBmiResultLocationState,
  UserDetailsPersonalLocationState,
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

export function UserDetailsBmiPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = (location.state as UserDetailsPersonalLocationState | null) ?? null;

  const [gender, setGender] = useState<"male" | "female" | "other">(state?.gender ?? "male");
  const age = useMemo(() => ageFromDob(state?.dob), [state?.dob]);
  const [heightCm, setHeightCm] = useState(130);
  const [weightKg, setWeightKg] = useState(129);
  const [heightUnit, setHeightUnit] = useState<"cm" | "feet">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [submitting, setSubmitting] = useState(false);

  const isDiabetic = state?.isDiabetic ?? "no";
  const isBloodPressure = state?.isBloodPressure ?? "no";

  const canCalculate = useMemo(() => {
    return heightCm > 0 && weightKg > 0 && !submitting;
  }, [heightCm, submitting, weightKg]);

  const displayedHeight = useMemo(() => {
    if (heightUnit === "cm") return Math.round(heightCm);
    return Number(cmToFeet(heightCm).toFixed(2));
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

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setSubmitting(true);
    try {
      const res = await calculatePatientBmi({
        name: state?.fullName ?? "",
        gender,
        dob: state?.dob ?? "",
        height: heightCm.toString(),
        weight: weightKg,
        isDiabetic: isDiabetic === "yes" ? "yes" : "no",
        language: state?.language ?? "",
        isBloodPressure: isBloodPressure === "yes" ? "yes" : "no",
      });
      const payload: UserDetailsBmiResultLocationState = {
        bmi: res.health_score.bmi,
        heightCm: Number(res.health_score.height),
        weightKg: Number(res.health_score.weight),
        nutritionSuggestion: Boolean(res.health_score.nutrition_suggestion),
        message: res.message,
      };
      navigate(ROUTES.userDetailsBmiResult, { replace: true, state: payload });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not calculate BMI");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="ud-flow-page">
      <header className="ud-flow-header">
        <button
          type="button"
          className="ud-flow-back"
          onClick={() => navigate(ROUTES.userDetailsPersonal, { replace: true, state })}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="ud-flow-title">User Details</h1>
      </header>

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

      <section className="ud-card">
        <div className="ud-gender-row">
          <button
            type="button"
            className={`ud-gender${gender === "male" ? " ud-gender--active" : ""}`}
            onClick={() => setGender("male")}
          >
            ♂ Male
          </button>
          <button
            type="button"
            className={`ud-gender${gender === "female" ? " ud-gender--active" : ""}`}
            onClick={() => setGender("female")}
          >
            ♀ Female
          </button>
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

