import { useFormStep } from "@/context/FormContext";
import type { WizardFormSteps } from "@/context/wizardFormTypes";
import { ROUTES } from "@/constants";
import { useNavigate } from "react-router-dom";
import { WIZARD_CATEGORIES } from "./wizardCatalog";
import { WizardScreenShell } from "./WizardNav";
import "./WizardScreens.css";

export function WizardScreen1() {
  const navigate = useNavigate();
  const [screen1, setScreen1] = useFormStep<"screen1", WizardFormSteps>("screen1");

  const selectCategory = (category: string) => {
    setScreen1({ category });
  };

  return (
    <WizardScreenShell
      title="Choose category"
      backFallback={ROUTES.dashboard}
      nextDisabled={!screen1.category}
      onNext={() => navigate(ROUTES.wizardScreen2)}
    >
      <p className="wizard-hint">Step 1 of 4 — selection is saved as you tap.</p>
      {WIZARD_CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`wizard-option${screen1.category === c.id ? " wizard-option--active" : ""}`}
          onClick={() => selectCategory(c.id)}
        >
          <input
            type="radio"
            name="category"
            checked={screen1.category === c.id}
            readOnly
            aria-hidden
          />
          <span>{c.label}</span>
        </button>
      ))}
    </WizardScreenShell>
  );
}
