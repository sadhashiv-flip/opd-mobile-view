/** Session snapshot written before navigating to gym overview (configure → overview). */
export const GYM_OVERVIEW_SNAPSHOT_KEY = "opd-mobile-view.gym-membership.overview-snapshot";

export type GymOverviewBeneficiarySnapshot = Readonly<{
  role: "primary" | "secondary";
  /** Account primary (self) vs dependent — overview card border matches configure. */
  isAccountPrimary: boolean;
  name: string;
  phone: string;
  email: string;
  cityChosen: boolean;
  planId: string;
}>;

export type GymOverviewSnapshot = Readonly<{
  planId: string;
  /** Logged-in account holder (self row) — overview "Primary User" block. */
  accountPrimaryUser: Readonly<{
    name: string;
    email: string;
    phone: string;
  }>;
  showSecondary: boolean;
  primary: GymOverviewBeneficiarySnapshot;
  secondary: GymOverviewBeneficiarySnapshot | null;
}>;

/** Raw JSON may omit newer fields; parsers migrate. */
export type GymOverviewSnapshotV1 = Readonly<{
  planId: string;
  primaryUserName?: string;
  primaryUserEmail?: string;
  accountPrimaryUser?: Readonly<{
    name: string;
    email: string;
    phone: string;
  }>;
  showSecondary: boolean;
  primary: Omit<GymOverviewBeneficiarySnapshot, "isAccountPrimary"> & { isAccountPrimary?: boolean };
  secondary:
    | (Omit<GymOverviewBeneficiarySnapshot, "isAccountPrimary"> & { isAccountPrimary?: boolean })
    | null;
}>;

function migrateBeneficiary(
  b: Omit<GymOverviewBeneficiarySnapshot, "isAccountPrimary"> & { isAccountPrimary?: boolean },
  legacyAccountPrimaryFallback: boolean,
): GymOverviewBeneficiarySnapshot {
  const isAccountPrimary =
    typeof b.isAccountPrimary === "boolean" ? b.isAccountPrimary : legacyAccountPrimaryFallback;
  return { ...b, isAccountPrimary };
}

/** Normalize session JSON (including v1 without `accountPrimaryUser` / `isAccountPrimary`). */
export function parseGymOverviewSnapshot(raw: string): GymOverviewSnapshot | null {
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Partial<GymOverviewSnapshotV1>;
    if (typeof o.planId !== "string" || !o.primary || typeof o.primary.planId !== "string") {
      return null;
    }
    const primary = o.primary;
    const secondary = o.secondary ?? null;

    const accountPrimaryUser =
      o.accountPrimaryUser &&
      typeof o.accountPrimaryUser === "object" &&
      typeof o.accountPrimaryUser.name === "string"
        ? {
            name: o.accountPrimaryUser.name,
            email:
              typeof o.accountPrimaryUser.email === "string" ? o.accountPrimaryUser.email : "—",
            phone:
              typeof o.accountPrimaryUser.phone === "string" ? o.accountPrimaryUser.phone : "—",
          }
        : {
            name:
              typeof o.primaryUserName === "string"
                ? o.primaryUserName
                : typeof primary.name === "string"
                  ? primary.name
                  : "—",
            email:
              typeof o.primaryUserEmail === "string"
                ? o.primaryUserEmail
                : typeof primary.email === "string"
                  ? primary.email
                  : "—",
            phone: typeof primary.phone === "string" ? primary.phone : "—",
          };

    return {
      planId: o.planId,
      accountPrimaryUser,
      showSecondary: Boolean(o.showSecondary),
      primary: migrateBeneficiary(primary, primary.role === "primary"),
      secondary: secondary ? migrateBeneficiary(secondary, false) : null,
    };
  } catch {
    return null;
  }
}
