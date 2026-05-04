/**
 * sessionStorage keys that are not under the `opd-mobile-view.*` namespace but still belong
 * to this app — {@link clearClientStorageOnUnauthorized} removes these on sign-out / 401.
 */
export const CLAIMS_DISCLOSURES_GATE_SESSION_KEY = "fh_claims_disclosures_ok";
