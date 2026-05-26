import { FormProvider } from "@/context/FormContext";
import { EMPTY_WIZARD_STEPS, WIZARD_FORM_STORAGE_KEY } from "@/context/wizardFormTypes";
import { Outlet } from "react-router-dom";

/**
 * Keeps wizard state in context (and localStorage) for all child routes.
 * Survives screen unmounts while the user stays inside `/wizard/*`.
 */
export function WizardFormLayout() {
  return (
    <FormProvider initialSteps={EMPTY_WIZARD_STEPS} storageKey={WIZARD_FORM_STORAGE_KEY}>
      <Outlet />
    </FormProvider>
  );
}
