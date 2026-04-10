import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants";
import type { RequiredLabTestsLocationState } from "@/types/navigation";
import "./RequiredLabTestsPage.css";

/**
 * Gate after login when `GET /required_lab_tests` reports `required_test` or `access_block`.
 * Replace with the real lab booking / compliance flow when ready.
 */
export function RequiredLabTestsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as RequiredLabTestsLocationState | null;
  const lab = state?.labTests;

  return (
    <main className="page required-lab-tests-page">
      <div className="required-lab-tests-page__card">
        <h1 className="required-lab-tests-page__title">Lab tests required</h1>
        <p className="required-lab-tests-page__body">
          Your account needs lab tests before you can continue. This step will be completed in a
          dedicated flow (coming next).
        </p>
        {lab ? (
          <p className="required-lab-tests-page__meta" aria-live="polite">
            {lab.used} of {lab.limit} tests used
          </p>
        ) : null}
        <button
          type="button"
          className="required-lab-tests-page__btn"
          onClick={() => navigate(ROUTES.dashboard, { replace: true })}
        >
          Back to home
        </button>
      </div>
    </main>
  );
}
