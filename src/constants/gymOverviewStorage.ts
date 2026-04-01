/** Session snapshot written before navigating to gym overview (configure → overview). */
export const GYM_OVERVIEW_SNAPSHOT_KEY = "opd-mobile-view.gym-membership.overview-snapshot";

export type GymOverviewBeneficiarySnapshot = Readonly<{
  role: "primary" | "secondary";
  name: string;
  phone: string;
  email: string;
  cityChosen: boolean;
  planId: string;
}>;

export type GymOverviewSnapshot = Readonly<{
  planId: string;
  primaryUserName: string;
  primaryUserEmail: string;
  showSecondary: boolean;
  primary: GymOverviewBeneficiarySnapshot;
  secondary: GymOverviewBeneficiarySnapshot | null;
}>;
