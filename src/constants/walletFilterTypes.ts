import { WALLET_REF_TYPE_API_VALUES, type WalletRefTypeApi } from "@/api/wallet";

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

/** Filter sheet & search: API value + UI label (screenshots + backend list). */
export const WALLET_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  api: WalletRefTypeApi;
  label: string;
}> = WALLET_REF_TYPE_API_VALUES.map((api) => ({
  api,
  label: labelForApi(api),
}));
