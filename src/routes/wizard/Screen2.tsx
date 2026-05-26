import { useFormContext, useFormStep } from "@/context/FormContext";
import type { WizardFormSteps } from "@/context/wizardFormTypes";
import { ROUTES } from "@/constants";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { WIZARD_SUBCATEGORIES } from "./wizardCatalog";
import { WizardScreenShell } from "./WizardNav";
import "./WizardScreens.css";

export function WizardScreen2() {
  const navigate = useNavigate();
  const { steps } = useFormContext<WizardFormSteps>();
  const [screen2, setScreen2] = useFormStep<"screen2", WizardFormSteps>("screen2");

  const category = steps.screen1.category;
  const options = useMemo(() => {
    if (!category || !(category in WIZARD_SUBCATEGORIES)) return [];
    return WIZARD_SUBCATEGORIES[category as keyof typeof WIZARD_SUBCATEGORIES];
  }, [category]);

  useEffect(() => {
    if (!category) {
      void navigate(ROUTES.wizardScreen1, { replace: true });
    }
  }, [category, navigate]);

  useEffect(() => {
    if (!screen2.subcategory) return;
    const valid = options.some((o) => o.id === screen2.subcategory);
    if (!valid) setScreen2({ subcategory: "" });
  }, [options, screen2.subcategory, setScreen2]);

  return (
    <WizardScreenShell
      title="Choose subcategory"
      backFallback={ROUTES.wizardScreen1}
      nextDisabled={!screen2.subcategory}
      onNext={() => navigate(ROUTES.wizardScreen3)}
    >
      <p className="wizard-hint">Step 2 of 4 — prefilled from your last visit to this step.</p>
      {!category ? (
        <p className="wizard-hint">Select a category on step 1 first.</p>
      ) : (
        options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`wizard-option${screen2.subcategory === o.id ? " wizard-option--active" : ""}`}
            onClick={() => setScreen2({ subcategory: o.id })}
          >
            <input
              type="radio"
              name="subcategory"
              checked={screen2.subcategory === o.id}
              readOnly
              aria-hidden
            />
            <span>{o.label}</span>
          </button>
        ))
      )}
    </WizardScreenShell>
  );
}
