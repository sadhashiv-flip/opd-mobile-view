import { useFormContext, useFormStep } from "@/context/FormContext";
import type { WizardFormSteps } from "@/context/wizardFormTypes";
import { ROUTES } from "@/constants";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WIZARD_FILTER_OPTIONS } from "./wizardCatalog";
import { WizardScreenShell } from "./WizardNav";
import "./WizardScreens.css";

export function WizardScreen3() {
  const navigate = useNavigate();
  const { steps } = useFormContext<WizardFormSteps>();
  const [screen3, , patchScreen3] = useFormStep<"screen3", WizardFormSteps>("screen3");

  useEffect(() => {
    if (!steps.screen1.category || !steps.screen2.subcategory) {
      void navigate(ROUTES.wizardScreen1, { replace: true });
    }
  }, [steps.screen1.category, steps.screen2.subcategory, navigate]);

  const toggleFilter = (id: string) => {
    const set = new Set(screen3.filters);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patchScreen3({ filters: [...set] });
  };

  return (
    <WizardScreenShell
      title="Choose filters"
      backFallback={ROUTES.wizardScreen2}
      nextDisabled={screen3.filters.length === 0}
      onNext={() => navigate(ROUTES.wizardScreen4)}
    >
      <p className="wizard-hint">Step 3 of 4 — pick one or more filters.</p>
      {WIZARD_FILTER_OPTIONS.map((f) => {
        const checked = screen3.filters.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            className={`wizard-option${checked ? " wizard-option--active" : ""}`}
            onClick={() => toggleFilter(f.id)}
          >
            <input type="checkbox" checked={checked} readOnly aria-hidden />
            <span>{f.label}</span>
          </button>
        );
      })}
    </WizardScreenShell>
  );
}
