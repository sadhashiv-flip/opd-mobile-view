export const WIZARD_CATEGORIES = [
  { id: "health", label: "Health" },
  { id: "fitness", label: "Fitness" },
  { id: "nutrition", label: "Nutrition" },
] as const;

export const WIZARD_SUBCATEGORIES: Record<
  (typeof WIZARD_CATEGORIES)[number]["id"],
  readonly { id: string; label: string }[]
> = {
  health: [
    { id: "checkup", label: "Checkup" },
    { id: "lab", label: "Lab tests" },
    { id: "vaccine", label: "Vaccination" },
  ],
  fitness: [
    { id: "gym", label: "Gym" },
    { id: "yoga", label: "Yoga" },
  ],
  nutrition: [
    { id: "diet", label: "Diet plan" },
    { id: "supplements", label: "Supplements" },
  ],
};

export const WIZARD_FILTER_OPTIONS = [
  { id: "home", label: "Home collection" },
  { id: "fasting", label: "Fasting required" },
  { id: "same-day", label: "Same-day slots" },
  { id: "wallet", label: "Wallet eligible" },
] as const;
