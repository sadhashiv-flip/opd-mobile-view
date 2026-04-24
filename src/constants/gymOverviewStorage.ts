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

/** Amounts from POST `gym/optIn` (quote/confirm) when available — preferred over client-side GST math. */
export type GymOverviewServerPayment = Readonly<{
  opt_in_amount: number | null;
  opd_paid_amount: number | null;
  opd_wallet_available: number | null;
  pending_amount: number | null;
  message?: string | null;
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
  /** Set after confirm completes without Razorpay or after payment_verify succeeds. */
  registrationComplete?: boolean;
  serverPayment?: GymOverviewServerPayment | null;
  /** Invoice id from Phase B confirm — used to deep-link to `/order/gym/:id` when payment rows aren’t in snapshot. */
  gymInvoiceId?: string | null;
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

    const serverPaymentRaw = (o as Partial<GymOverviewSnapshot>).serverPayment;
    const serverPayment =
      serverPaymentRaw &&
      typeof serverPaymentRaw === "object" &&
      !Array.isArray(serverPaymentRaw)
        ? (serverPaymentRaw as GymOverviewServerPayment)
        : undefined;

    const registrationComplete =
      (o as Partial<GymOverviewSnapshot>).registrationComplete === true;

    const gymInvoiceIdRaw = (o as Partial<GymOverviewSnapshot>).gymInvoiceId;
    const gymInvoiceId =
      typeof gymInvoiceIdRaw === "string" && gymInvoiceIdRaw.trim()
        ? gymInvoiceIdRaw.trim()
        : undefined;

    return {
      planId: o.planId,
      accountPrimaryUser,
      showSecondary: Boolean(o.showSecondary),
      primary: migrateBeneficiary(primary, primary.role === "primary"),
      secondary: secondary ? migrateBeneficiary(secondary, false) : null,
      ...(registrationComplete ? { registrationComplete: true as const } : {}),
      ...(serverPayment ? { serverPayment } : {}),
      ...(gymInvoiceId ? { gymInvoiceId } : {}),
    };
  } catch {
    return null;
  }
}
