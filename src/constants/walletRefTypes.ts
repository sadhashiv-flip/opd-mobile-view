/** `ref_type` values accepted by transaction search (backend). */
export const WALLET_REF_TYPE_API_VALUES = [
  "Consultation",
  "Labtest",
  "Pharmacy",
  "Dental",
  "Vision",
  "Vaccine",
  "Nutrition",
  "Fitness",
  "Yoga",
  "Chronic_Optin",
  "MentalWellnesss",
] as const;

export type WalletRefTypeApi = (typeof WALLET_REF_TYPE_API_VALUES)[number];

function labelForApi(api: WalletRefTypeApi): string {
  switch (api) {
    case "Labtest":
      return "Labtest";
    case "MentalWellnesss":
      return "Mental Wellness";
    case "Chronic_Optin":
      return "Chronic Opt-in";
    default:
      return api;
  }
}

/** Filter sheet & search: API value + UI label. */
export const WALLET_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  api: WalletRefTypeApi;
  label: string;
}> = WALLET_REF_TYPE_API_VALUES.map((api) => ({
  api,
  label: labelForApi(api),
}));

/** Human-readable service label from API `ref_type` (e.g. `VISION` → `Vision`). */
export function formatWalletRefTypeTitle(refType: string): string {
  const raw = refType.trim();
  if (!raw) return "Transaction";
  const match = WALLET_TYPE_FILTER_OPTIONS.find(
    (o) => o.api.toLowerCase() === raw.toLowerCase(),
  );
  if (match) return match.label;
  return raw
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
