import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { navigateDashboardWithLabGate } from "@/lib/postVerifyNavigation";
import type { UserDetailsBmiResultLocationState } from "@/types/navigation";
import "./UserDetailsFlow.css";

function bmiCategory(bmi: number): "underweight" | "healthy" | "overweight" | "obese" {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "healthy";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function UserDetailsBmiResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as UserDetailsBmiResultLocationState | null) ?? null;

  if (!state || !Number.isFinite(state.bmi)) {
    navigate(ROUTES.userDetailsBmi, { replace: true });
    return null;
  }

  const bmi = state.bmi;
  const category = bmiCategory(bmi);
  const heightCm = Number.isFinite(state.heightCm) ? state.heightCm : 0;
  const heightM = heightCm > 0 ? heightCm / 100 : 0;

  const idealWeightRange = (() => {
    if (heightM <= 0) return "—";
    const min = 18.5 * heightM * heightM;
    const max = 24.9 * heightM * heightM;
    return `${min.toFixed(1)} - ${max.toFixed(1)} kg`;
  })();

  const resultMessage = (() => {
    if (category === "underweight") return "Your BMI indicates you're underweight. Consider gaining weight through a balanced diet.";
    if (category === "overweight") return "Your BMI indicates you're overweight. Consider consulting a nutritionist for weight management.";
    if (category === "obese") return "Your BMI indicates obesity. Please consult a healthcare professional for personalized advice.";
    return "Your BMI is in the healthy range. Keep up the good work!";
  })();

  const resultIcon = (() => {
    if (category === "underweight") return "⚠";
    if (category === "overweight") return "⚠";
    if (category === "obese") return "⚠";
    return "✓";
  })();

  return (
    <main className="ud-flow-page ud-result-page">
      <section className={`ud-result-card ud-result-card--${category}`}>
        <p className="ud-result-card__small">here&apos;s your</p>
        <h1 className="ud-result-card__title">Body Mass Index</h1>
        <div className="ud-result-card__value">{bmi.toFixed(1)}</div>
        <div className="ud-result-card__label">BMI Score</div>
      </section>

      <section className="ud-bmi-scale">
        <div className="ud-bmi-scale__bar">
          <span className="ud-bmi-scale__segment ud-bmi-scale__segment--under" />
          <span className="ud-bmi-scale__segment ud-bmi-scale__segment--healthy" />
          <span className="ud-bmi-scale__segment ud-bmi-scale__segment--over" />
          <span className="ud-bmi-scale__segment ud-bmi-scale__segment--obese" />
        </div>
        <div className="ud-bmi-scale__ticks">
          <span>0</span>
          <span>18.5</span>
          <span>25</span>
          <span>30+</span>
        </div>
        <div className="ud-bmi-scale__legend">
          <span className="ud-dot ud-dot--under">Underweight</span>
          <span className="ud-dot ud-dot--healthy">Healthy</span>
          <span className="ud-dot ud-dot--over">Overweight</span>
          <span className="ud-dot ud-dot--obese">Obese</span>
        </div>
      </section>

      <section className={`ud-result-note ud-result-note--${category}`}>
        <span className="ud-result-note__icon" aria-hidden>
          {resultIcon}
        </span>
        <p className="ud-result-note__text">
          {resultMessage}
        </p>
      </section>

      <section className="ud-result-grid">
        <article className="ud-result-metric ud-result-metric--ideal">
          <div className="ud-result-metric__icon" aria-hidden>
            ◉
          </div>
          <div className="ud-result-metric__label">Ideal Weight</div>
          <div className="ud-result-metric__value">{idealWeightRange}</div>
        </article>
        <article className="ud-result-metric ud-result-metric--height">
          <div className="ud-result-metric__icon" aria-hidden>
            ▭
          </div>
          <div className="ud-result-metric__label">Height</div>
          <div className="ud-result-metric__value">{heightCm.toFixed(1)} cm</div>
        </article>
      </section>

      {state.nutritionSuggestion ? (
        <div className="ud-result-actions">
          <button
            type="button"
            className="ud-primary ud-result-page__consult"
            onClick={() => navigate(ROUTES.consultationType, { replace: true })}
          >
            Consult Doctor
          </button>
          <button
            type="button"
            className="ud-secondary ud-result-page__skip"
            onClick={() => void navigateDashboardWithLabGate(navigate)}
          >
            Skip
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ud-primary ud-result-page__continue"
          onClick={() => void navigateDashboardWithLabGate(navigate)}
        >
          Continue
        </button>
      )}
    </main>
  );
}

