/** Demo wizard shape — extend or replace for real booking flows. */
export type WizardScreen1Data = Readonly<{
  category: string;
}>;

export type WizardScreen2Data = Readonly<{
  subcategory: string;
}>;

export type WizardScreen3Data = Readonly<{
  filters: readonly string[];
}>;

export type WizardFormSteps = Readonly<{
  screen1: WizardScreen1Data;
  screen2: WizardScreen2Data;
  screen3: WizardScreen3Data;
}>;

export const WIZARD_FORM_STORAGE_KEY = "opd-mobile-view.wizard.demo.v1";

export const EMPTY_WIZARD_STEPS: WizardFormSteps = {
  screen1: { category: "" },
  screen2: { subcategory: "" },
  screen3: { filters: [] },
};
