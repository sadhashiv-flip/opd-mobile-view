import { useFormContext } from "@/context/FormContext";
import type { WizardFormSteps } from "@/context/wizardFormTypes";
import { ROUTES } from "@/constants";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  WIZARD_CATEGORIES,
  WIZARD_FILTER_OPTIONS,
  WIZARD_SUBCATEGORIES,
} from "./wizardCatalog";
import { WizardScreenShell } from "./WizardNav";
import "./WizardScreens.css";

function labelForCategory(id: string): string {
  return WIZARD_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function labelForSubcategory(category: string, sub: string): string {
  const list = WIZARD_SUBCATEGORIES[category as keyof typeof WIZARD_SUBCATEGORIES];
  return list?.find((s) => s.id === sub)?.label ?? sub;
}

function labelForFilters(ids: readonly string[]): string {
  if (ids.length === 0) return "—";
  return ids
    .map((id) => WIZARD_FILTER_OPTIONS.find((f) => f.id === id)?.label ?? id)
    .join(", ");
}

export function WizardScreen4() {
  const navigate = useNavigate();
  const { steps, resetForm } = useFormContext<WizardFormSteps>();

  useEffect(() => {
    if (!steps.screen1.category || !steps.screen2.subcategory || steps.screen3.filters.length === 0) {
      void navigate(ROUTES.wizardScreen1, { replace: true });
    }
  }, [
    navigate,
    steps.screen1.category,
    steps.screen2.subcategory,
    steps.screen3.filters.length,
  ]);

  return (
    <WizardScreenShell
      title="Summary"
      backFallback={ROUTES.wizardScreen3}
      showNext={false}
    >
      <p className="wizard-hint">Step 4 of 4 — all selections from the global store.</p>

      <div className="wizard-summary">
        <section className="wizard-summary__card">
          <p className="wizard-summary__label">Category</p>
          <p className="wizard-summary__value">{labelForCategory(steps.screen1.category)}</p>
          <button
            type="button"
            className="wizard-summary__edit"
            onClick={() => navigate(ROUTES.wizardScreen1)}
          >
            Edit
          </button>
        </section>

        <section className="wizard-summary__card">
          <p className="wizard-summary__label">Subcategory</p>
          <p className="wizard-summary__value">
            {labelForSubcategory(steps.screen1.category, steps.screen2.subcategory)}
          </p>
          <button
            type="button"
            className="wizard-summary__edit"
            onClick={() => navigate(ROUTES.wizardScreen2)}
          >
            Edit
          </button>
        </section>

        <section className="wizard-summary__card">
          <p className="wizard-summary__label">Filters</p>
          <p className="wizard-summary__value">{labelForFilters(steps.screen3.filters)}</p>
          <button
            type="button"
            className="wizard-summary__edit"
            onClick={() => navigate(ROUTES.wizardScreen3)}
          >
            Edit
          </button>
        </section>
      </div>

      <footer className="wizard-screen__footer" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="wizard-screen__next"
          onClick={() => {
            resetForm();
            navigate(ROUTES.dashboard);
          }}
        >
          Finish &amp; return home
        </button>
      </footer>
    </WizardScreenShell>
  );
}
