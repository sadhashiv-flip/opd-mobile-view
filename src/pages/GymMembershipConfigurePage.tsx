import {
  getGymCheck,
  postGymOptInConfirm,
  postGymOptInQuote,
  type GymOptInRequest,
  type GymOptInResult,
} from "@/api/patientGym";
import { verifyGymPayment } from "@/api/patientGymPayment";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { ROUTES } from "@/constants";
import { readGymCheckSnapshot, writeGymCheckSnapshot } from "@/constants/gymCheckStorage";
import {
  buildGymMemberSnapshotFromRow,
  clearGymSelectedMemberSnapshot,
  enrichGymMemberSnapshot,
  readGymSelectedMembersSnapshots,
  readGymSelectedPersonIds,
  writeGymSelectedMembersSnapshots,
  writeGymSelectedPersonIds,
  type GymSelectedMemberSnapshot,
} from "@/constants/gymSelectedMemberStorage";
import {
  GYM_OVERVIEW_SNAPSHOT_KEY,
  type GymOverviewServerPayment,
  type GymOverviewSnapshot,
} from "@/constants/gymOverviewStorage";
import { GymBenefitsModal } from "@/components/gym/GymBenefitsModal";
import { GymPlanTierHeading } from "@/components/gym/GymPlanTierHeading";
import { GymRemoveMemberConfirmModal } from "@/components/gym/GymRemoveMemberConfirmModal";
import { GymTermsSheet } from "@/components/gym/GymTermsSheet";
import {
  GYM_MEMBERSHIP_PLANS,
  getGymMembershipTermsProductPhrase,
  getGymPlanPackageLabel,
  type GymMembershipPlan,
} from "@/constants/gymPlans";
import { gymPackageToMembershipPlan } from "@/lib/gymPackageToPlan";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { resolveGymMembershipPlan } from "@/lib/resolveGymMembershipPlan";
import { GYM_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import { useToast } from "@/hooks/useToast";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
} from "@/lib/gymMembershipRazorpayPay";
import {
  normalizeRazorpayCheckoutPayload,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./HealthCheckupsOverviewPage.css";
import "./GymMembershipPage.css";
import "./GymMembershipConfigurePage.css";

function planAccentClass(accent: GymMembershipPlan["accent"]): string {
  if (accent === "gold") return " gym-plan-card--gold";
  if (accent === "orange") return " gym-plan-card--orange";
  return " gym-plan-card--blue";
}

const FAMILY_STORAGE_KEY = "opd-mobile-view.health-checkups.family";
const GYM_PLAN_ID_KEY = "opd-mobile-view.gym-membership.planId";

const SEED_MEMBERS: readonly GymMemberListRow[] = [
  {
    id: "self-1",
    name: "Gundari Abhinay",
    subtitle: "sponsored by your company",
    section: "self",
    userId: null,
    phone: "9876543210",
    email: "abhinay@email.com",
    ahcAvailable: false,
    isSubscribed: true,
    subscriptionCanActivate: false,
  },
  {
    id: "family-1",
    name: "Gundari Abhinay",
    subtitle: "Packages available",
    section: "family",
    userId: null,
    phone: "9876543210",
    email: "xxxxxxx@email.com",
    ahcAvailable: false,
    isSubscribed: true,
    subscriptionCanActivate: false,
  },
];

function readStoredPlanId(): string | null {
  try {
    const p = localStorage.getItem(GYM_PLAN_ID_KEY);
    return p && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

function loadMembers(): GymMemberListRow[] {
  const fromStorage: GymMemberListRow[] = [];
  try {
    const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if (
            m &&
            typeof m === "object" &&
            "id" in m &&
            "name" in m &&
            "subtitle" in m &&
            typeof (m as { id: unknown }).id === "string" &&
            typeof (m as { name: unknown }).name === "string" &&
            typeof (m as { subtitle: unknown }).subtitle === "string"
          ) {
            const row = m as {
              id: string;
              name: string;
              subtitle: string;
              phone?: unknown;
            };
            fromStorage.push({
              id: row.id,
              name: row.name,
              subtitle: row.subtitle,
              section: "family",
              userId: null,
              phone: typeof row.phone === "string" ? row.phone : "9876543210",
              email: "xxxxxxx@email.com",
              ahcAvailable: false,
              isSubscribed: true,
              subscriptionCanActivate: false,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return [...SEED_MEMBERS, ...fromStorage];
}

function PinIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function dashField(v: string): string {
  return v.trim() ? v.trim() : "—";
}

function serverPaymentFromOptIn(r: GymOptInResult): GymOverviewServerPayment {
  return {
    opt_in_amount: r.opt_in_amount,
    opd_paid_amount: r.opd_paid_amount,
    opd_wallet_available: r.opd_wallet_available,
    pending_amount: r.pending_amount,
    message: r.message,
  };
}

function formatQuoteRupees(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Phase A quote: Razorpay needed when server says payment is required and there is still an amount due. */
function quoteExpectsRazorpayGateway(q: GymOptInResult): boolean {
  return Boolean(q.payment_required && (q.pending_amount ?? 0) > 0);
}

/** Razorpay Checkout `amount` is in paise */
function paiseFromRazorpayPayload(payload: Record<string, unknown>): number | null {
  const a = payload.amount;
  if (typeof a === "number" && Number.isFinite(a) && a > 0) return Math.round(a);
  if (typeof a === "string" && /^\d+$/.test(a.trim())) {
    const n = Number.parseInt(a.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function formatPaiseAsRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: rupees % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** POST payment_verify until server stops returning a fresh Razorpay payload (resume flow). */
async function verifyGymPaymentWithOptionalGateway(
  invoiceId: string,
  firstPaymentId: string,
  onCheckoutFailed: (message: string) => void,
): Promise<void> {
  let paymentId = firstPaymentId;
  for (;;) {
    const vr = await verifyGymPayment({
      invoice_id: invoiceId,
      payment_id: paymentId,
    });
    const rzp = vr.razorpay_payload;
    if (rzp == null || Object.keys(rzp).length === 0) return;

    await loadRazorpayScript();
    if (!(globalThis as unknown as { Razorpay?: unknown }).Razorpay) {
      throw new Error("Razorpay Checkout could not load. Check your network or ad blocker.");
    }

    paymentId = await new Promise<string>((resolve, reject) => {
      const onFail = (m: string) => {
        window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onNext);
        onCheckoutFailed(m);
        reject(new Error(m));
      };
      const onNext = (e: Event) => {
        window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onNext);
        const d = (e as CustomEvent<unknown>).detail;
        if (
          d &&
          typeof d === "object" &&
          typeof (d as { razorpay_payment_id?: unknown }).razorpay_payment_id === "string"
        ) {
          resolve((d as { razorpay_payment_id: string }).razorpay_payment_id);
          return;
        }
        reject(new Error("Invalid payment response"));
      };
      window.addEventListener(GYM_PAYMENT_DONE_EVENT, onNext);
      openRazorpayCheckoutWithEvent(
        normalizeRazorpayCheckoutPayload({ ...rzp }),
        GYM_PAYMENT_DONE_EVENT,
        onFail,
      );
    });
  }
}

function GymConfigureMemberBlock({
  member,
  cityConfirmed,
  cityDisplay,
  onChooseCity,
}: Readonly<{
  member: GymSelectedMemberSnapshot;
  cityConfirmed: boolean;
  cityDisplay: string;
  onChooseCity: () => void;
}>) {
  const showCityValue = cityConfirmed && Boolean(cityDisplay.trim());

  return (
    <div className="gmc-member-block">
      <h3 className="gmc-member-block__title">Member details</h3>
      <p className="gmc-member-block__name">{member.name}</p>
      {member.relation ? <p className="gmc-member-block__relation">{member.relation}</p> : null}
      <dl className="gmc-member-block__meta">
        <div className="gmc-member-block__row gmc-member-block__row--triple">
          <div className="gmc-member-block__cell">
            <dt>Phone</dt>
            <dd>{dashField(member.phone)}</dd>
          </div>
          <div className="gmc-member-block__cell">
            <dt>Gender</dt>
            <dd>{dashField(member.gender)}</dd>
          </div>
          <div className="gmc-member-block__cell">
            <dt>DOB</dt>
            <dd>{dashField(member.dob)}</dd>
          </div>
        </div>
        <div className="gmc-member-block__row gmc-member-block__row--pair">
          <div className="gmc-member-block__cell">
            <dt>Email</dt>
            <dd>{dashField(member.email)}</dd>
          </div>
          <div className="gmc-member-block__cell">
            <dt>City</dt>
            <dd className="gmc-member-block__dd--city">
              {showCityValue ? (
                <span>{cityDisplay.trim()}</span>
              ) : (
                <button type="button" className="gmc-card__link" onClick={onChooseCity}>
                  Choose location
                </button>
              )}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

/** Green (primary) vs orange (dependent) — by account role, not gym slot order. */
function isAccountPrimaryMember(
  member: GymSelectedMemberSnapshot,
  accountPrimaryId: string | null,
): boolean {
  if (member.sourceSection === "self") return true;
  if (member.sourceSection === "family") return false;
  return Boolean(accountPrimaryId && member.id === accountPrimaryId);
}

type GymMemberCardProps = Readonly<{
  member: GymSelectedMemberSnapshot;
  /** Id of the account holder row from GET /member (`section === "self"`), for legacy snapshots without `sourceSection`. */
  accountPrimaryMemberId: string | null;
  cityConfirmed: boolean;
  cityDisplay: string;
  packageChosen: boolean;
  packageLabel: string;
  resolvedPlan: GymMembershipPlan | null;
  onClose: () => void;
  showClose: boolean;
  onChooseCity: () => void;
  onChoosePackage: () => void;
  onCenterList: () => void;
}>;

function GymMemberConfigureCard({
  member,
  accountPrimaryMemberId,
  cityConfirmed,
  cityDisplay,
  packageChosen,
  packageLabel,
  resolvedPlan,
  onClose,
  showClose,
  onChooseCity,
  onChoosePackage,
  onCenterList,
}: GymMemberCardProps) {
  const isPrimary = isAccountPrimaryMember(member, accountPrimaryMemberId);
  const bandLabel = isPrimary ? "Primary" : "Dependent";
  const cardClass = isPrimary ? "gmc-card gmc-card--primary" : "gmc-card gmc-card--secondary";

  return (
    <article className={cardClass}>
      {showClose ? (
        <button type="button" className="gmc-card__close" onClick={onClose} aria-label={`Remove ${bandLabel}`}>
          ×
        </button>
      ) : null}
      <div className="gmc-card__inner">
        <div className="gmc-card__body">
          <GymConfigureMemberBlock
            member={member}
            cityConfirmed={cityConfirmed}
            cityDisplay={cityDisplay}
            onChooseCity={onChooseCity}
          />
          {packageChosen && resolvedPlan ? (
            <div className="gmc-plan-detail">
              <div className="gmc-plan-detail__head">
                <p className="gmc-plan-detail__heading">Selected package</p>
                <button type="button" className="gmc-card__center-list" onClick={onCenterList}>
                  <PinIcon className="gmc-card__center-list-pin" />
                  Center List
                </button>
              </div>
              <div className="gmc-card__row gmc-card__row--plan-detail">
                <span className="gmc-card__label">Name</span>
                <span className="gmc-card__sep" aria-hidden="true">
                  :
                </span>
                <span className="gmc-card__value">{resolvedPlan.cardTitle ?? packageLabel}</span>
              </div>
              <div className="gmc-card__row gmc-card__row--plan-detail">
                <span className="gmc-card__label">Validity</span>
                <span className="gmc-card__sep" aria-hidden="true">
                  :
                </span>
                <span className="gmc-card__value">{resolvedPlan.months} months</span>
              </div>
              <div className="gmc-card__row gmc-card__row--plan-detail">
                <span className="gmc-card__label">Price</span>
                <span className="gmc-card__sep" aria-hidden="true">
                  :
                </span>
                <span className="gmc-card__value gmc-card__value--price">
                  {resolvedPlan.oldPrice > resolvedPlan.price ? (
                    <>
                      <del className="gmc-plan-detail__mrp">₹{resolvedPlan.oldPrice.toLocaleString()}</del>{" "}
                    </>
                  ) : null}
                  ₹{resolvedPlan.price.toLocaleString()}
                  <span className="gmc-plan-detail__per"> / person</span>
                </span>
              </div>
              {resolvedPlan.packageCode ? (
                <div className="gmc-card__row gmc-card__row--plan-detail">
                  <span className="gmc-card__label">Code</span>
                  <span className="gmc-card__sep" aria-hidden="true">
                    :
                  </span>
                  <span className="gmc-card__value">{resolvedPlan.packageCode}</span>
                </div>
              ) : null}
              <p className="gmc-plan-detail__note">{resolvedPlan.taxFeesLabel}</p>
            </div>
          ) : (
            <div className="gmc-package-actions">
              <button type="button" className="gmc-card__link" onClick={onChoosePackage}>
                Select Package
              </button>
              <button type="button" className="gmc-card__center-list" onClick={onCenterList}>
                <PinIcon className="gmc-card__center-list-pin" />
                Center List
              </button>
            </div>
          )}
        </div>
        <div className="gmc-card__band">
          <ShieldIcon className="gmc-card__band-shield" />
          <span className="gmc-card__band-label">{bandLabel}</span>
        </div>
      </div>
    </article>
  );
}

export function GymMembershipConfigurePage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(ROUTES.gymMembership, { replace: true });
  }, [navigate]);

  const location = useLocation();
  const toast = useToast();
  const statePlanId =
    typeof (location.state as { planId?: unknown } | null)?.planId === "string"
      ? (location.state as { planId: string }).planId
      : null;
  const planId = statePlanId ?? readStoredPlanId();

  const gymCheck = useMemo(() => readGymCheckSnapshot(), [location.key]);

  const displayPlans = useMemo((): readonly GymMembershipPlan[] => {
    if (gymCheck?.packages.length) {
      return gymCheck.packages.map((p, i) => gymPackageToMembershipPlan(p, i));
    }
    return GYM_MEMBERSHIP_PLANS;
  }, [gymCheck]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [storageEpoch, setStorageEpoch] = useState(0);
  const [primaryCity, setPrimaryCity] = useState(false);
  const [secondaryCity, setSecondaryCity] = useState(false);
  const [primaryMemberPlanId, setPrimaryMemberPlanId] = useState<string | null>(null);
  const [secondaryMemberPlanId, setSecondaryMemberPlanId] = useState<string | null>(null);
  const [packageSheetTarget, setPackageSheetTarget] = useState<"primary" | "secondary" | null>(
    null,
  );
  const [sheetPlanId, setSheetPlanId] = useState<string | null>(null);
  const [benefitsPlan, setBenefitsPlan] = useState<GymMembershipPlan | null>(null);
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<"primary" | "secondary" | null>(
    null,
  );
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [quoteReviewOpen, setQuoteReviewOpen] = useState(false);
  const [quoteResult, setQuoteResult] = useState<GymOptInResult | null>(null);
  const pendingOptInBodyRef = useRef<GymOptInRequest | null>(null);
  /** After confirm returns Razorpay payload — user taps Pay now (same pattern as diagnostics / bookings). */
  const [awaitingRazorpayPay, setAwaitingRazorpayPay] = useState<
    | null
    | Readonly<{
        invoiceId: string;
        razorpayPayload: Record<string, unknown>;
        confirmResult: GymOptInResult;
      }>
  >(null);
  const [razorpayBusy, setRazorpayBusy] = useState(false);

  const [apiMemberRows, setApiMemberRows] = useState<GymMemberListRow[] | null>(null);
  const [apiMembersReady, setApiMembersReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setApiMembersReady(false);
    void Promise.all([fetchAllPatientMembers(), fetchAnySubscriptionCanActivate()])
      .then(([list, canAct]) => {
        if (!cancelled) {
          setApiMemberRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiMemberRows(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setApiMembersReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [location.key]);

  const selectedPersonIds = useMemo(
    () => readGymSelectedPersonIds(),
    [location.key, storageEpoch],
  );

  const storedMemberSnapshots = useMemo(
    () => readGymSelectedMembersSnapshots(),
    [location.key, storageEpoch],
  );

  const primaryResolved = useMemo((): GymSelectedMemberSnapshot | null => {
    const id = selectedPersonIds[0];
    if (!id) return null;
    const snapAligned = storedMemberSnapshots[0]?.id === id ? storedMemberSnapshots[0] : undefined;
    const snap = snapAligned ?? storedMemberSnapshots.find((s) => s.id === id);
    if (snap) {
      return enrichGymMemberSnapshot(snap, gymCheck);
    }
    const all: GymMemberListRow[] =
      apiMembersReady && apiMemberRows !== null ? apiMemberRows : loadMembers();
    const row = all.find((m) => m.id === id);
    if (!row) return null;
    return enrichGymMemberSnapshot(buildGymMemberSnapshotFromRow(row, gymCheck), gymCheck);
  }, [
    selectedPersonIds,
    storedMemberSnapshots,
    gymCheck,
    apiMembersReady,
    apiMemberRows,
    location.key,
  ]);

  const secondaryResolved = useMemo((): GymSelectedMemberSnapshot | null => {
    const id = selectedPersonIds[1];
    if (!id) return null;
    const snapAligned = storedMemberSnapshots[1]?.id === id ? storedMemberSnapshots[1] : undefined;
    const snap = snapAligned ?? storedMemberSnapshots.find((s) => s.id === id);
    if (snap) {
      return enrichGymMemberSnapshot(snap, gymCheck);
    }
    const all: GymMemberListRow[] =
      apiMembersReady && apiMemberRows !== null ? apiMemberRows : loadMembers();
    const row = all.find((m) => m.id === id);
    if (!row) return null;
    return enrichGymMemberSnapshot(buildGymMemberSnapshotFromRow(row, gymCheck), gymCheck);
  }, [
    selectedPersonIds,
    storedMemberSnapshots,
    gymCheck,
    apiMembersReady,
    apiMemberRows,
    location.key,
  ]);

  /** Second configure card whenever two members were chosen on select-people. */
  const showSecondary = useMemo(
    () => selectedPersonIds.length >= 2 && secondaryResolved !== null,
    [selectedPersonIds.length, secondaryResolved],
  );

  const accountPrimaryMemberId = useMemo((): string | null => {
    if (!apiMembersReady || !apiMemberRows?.length) return null;
    return apiMemberRows.find((r) => r.section === "self")?.id ?? null;
  }, [apiMembersReady, apiMemberRows]);

  const primaryPackageLabel = useMemo(
    () => getGymPlanPackageLabel(primaryMemberPlanId, gymCheck),
    [primaryMemberPlanId, gymCheck],
  );
  const secondaryPackageLabel = useMemo(
    () => getGymPlanPackageLabel(secondaryMemberPlanId, gymCheck),
    [secondaryMemberPlanId, gymCheck],
  );

  const termsMembershipPhrase = useMemo(
    () => getGymMembershipTermsProductPhrase(primaryMemberPlanId ?? planId, gymCheck),
    [primaryMemberPlanId, planId, gymCheck],
  );

  const termsPartnerTnc = useMemo(() => {
    const pid = primaryMemberPlanId ?? planId;
    if (!pid || !gymCheck?.packages.length) return null;
    const pkg = gymCheck.packages.find((p) => p.package_code === pid);
    return pkg?.tnc?.trim() ? pkg.tnc : null;
  }, [primaryMemberPlanId, planId, gymCheck]);

  const primaryResolvedPlan = useMemo(
    () => resolveGymMembershipPlan(primaryMemberPlanId, gymCheck),
    [primaryMemberPlanId, gymCheck],
  );

  const secondaryResolvedPlan = useMemo(
    () => resolveGymMembershipPlan(secondaryMemberPlanId, gymCheck),
    [secondaryMemberPlanId, gymCheck],
  );

  const orderLocationLabel = gymCheck?.order?.details?.location?.trim() ?? "";

  const primaryCityDisplay = useMemo(() => {
    if (!primaryResolved) return "";
    if (primaryResolved.city.trim()) return primaryResolved.city.trim();
    if (primaryCity) return orderLocationLabel || "Indiranagar, Bengaluru";
    return "";
  }, [primaryResolved, primaryCity, orderLocationLabel]);

  const primaryCityConfirmed = Boolean(primaryResolved?.city.trim()) || primaryCity;

  const secondaryCityDisplay = useMemo(() => {
    if (!secondaryResolved) return "";
    if (secondaryResolved.city.trim()) return secondaryResolved.city.trim();
    if (secondaryCity) return orderLocationLabel || "Indiranagar, Bengaluru";
    return "";
  }, [secondaryResolved, secondaryCity, orderLocationLabel]);

  const secondaryCityConfirmed = Boolean(secondaryResolved?.city.trim()) || secondaryCity;

  useEffect(() => {
    if (!planId) {
      navigate(ROUTES.gymMembership, { replace: true });
    }
  }, [planId, navigate]);

  useEffect(() => {
    if (selectedPersonIds.length === 0) {
      navigate(ROUTES.gymMembershipSelectPeople, {
        replace: true,
        state: planId ? { planId } : undefined,
      });
    }
  }, [selectedPersonIds.length, planId, navigate]);

  useEffect(() => {
    if (selectedPersonIds.length === 0 || !apiMembersReady || !planId) return;
    if (primaryResolved === null) {
      navigate(ROUTES.gymMembershipSelectPeople, {
        replace: true,
        state: { planId },
      });
    }
  }, [selectedPersonIds.length, apiMembersReady, primaryResolved, planId, navigate]);

  // Default each member's package to the plan already chosen on the plans screen so
  // Continue can enable after terms — users can still change packages via Select Package.
  useEffect(() => {
    if (!planId) return;
    if (!displayPlans.some((p) => p.id === planId)) return;
    setPrimaryMemberPlanId((prev) => prev ?? planId);
    setSecondaryMemberPlanId((prev) => prev ?? planId);
  }, [planId, displayPlans]);

  useEffect(() => {
    const loc = gymCheck?.order?.details?.location?.trim();
    if (loc) {
      setPrimaryCity(true);
    }
  }, [gymCheck]);

  const packagesReady =
    primaryMemberPlanId !== null &&
    (!showSecondary || secondaryMemberPlanId !== null);
  const canContinue = termsAccepted && packagesReady;

  const backState = planId ? { planId } : undefined;

  const persistOverviewAndNavigate = useCallback(
    (payment: GymOptInResult | null, registrationComplete: boolean) => {
      if (!primaryResolved || !primaryMemberPlanId) return;
      const selfRow = apiMemberRows?.find((r) => r.section === "self");
      const accountPrimaryUser = (() => {
        if (selfRow) {
          const snap = enrichGymMemberSnapshot(
            buildGymMemberSnapshotFromRow(selfRow, gymCheck),
            gymCheck,
          );
          return {
            name: snap.name,
            email:
              snap.email?.trim() ||
              `${snap.name.replaceAll(/\s+/g, "").toLowerCase()}@email.com`,
            phone: snap.phone?.trim() || "—",
          };
        }
        return {
          name: primaryResolved.name,
          email:
            primaryResolved.email?.trim() ||
            `${primaryResolved.name.replaceAll(/\s+/g, "").toLowerCase()}@email.com`,
          phone: primaryResolved.phone?.trim() || "—",
        };
      })();
      const snapshot: GymOverviewSnapshot = {
        planId: planId ?? primaryMemberPlanId,
        accountPrimaryUser,
        showSecondary,
        primary: {
          role: "primary",
          isAccountPrimary: isAccountPrimaryMember(primaryResolved, accountPrimaryMemberId),
          name: primaryResolved.name,
          phone: primaryResolved.phone?.trim() || "—",
          email: primaryResolved.email?.trim() || "—",
          cityChosen: primaryCityConfirmed,
          planId: primaryMemberPlanId,
        },
        secondary:
          showSecondary && secondaryMemberPlanId && secondaryResolved
            ? {
                role: "secondary",
                isAccountPrimary: isAccountPrimaryMember(secondaryResolved, accountPrimaryMemberId),
                name: secondaryResolved.name,
                phone: secondaryResolved.phone?.trim() || "—",
                email: secondaryResolved.email?.trim() || "—",
                cityChosen: secondaryCityConfirmed,
                planId: secondaryMemberPlanId,
              }
            : null,
        registrationComplete,
        serverPayment: payment ? serverPaymentFromOptIn(payment) : undefined,
        ...(payment?.invoice_id?.trim()
          ? { gymInvoiceId: payment.invoice_id.trim() }
          : {}),
      };
      try {
        sessionStorage.setItem(GYM_OVERVIEW_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore storage errors
      }
      navigate(ROUTES.gymMembershipOverview);
    },
    [
      primaryResolved,
      primaryMemberPlanId,
      showSecondary,
      secondaryMemberPlanId,
      secondaryResolved,
      primaryCityConfirmed,
      secondaryCityConfirmed,
      gymCheck,
      apiMemberRows,
      accountPrimaryMemberId,
      planId,
      navigate,
    ],
  );

  /** Phase A — quote: `POST /patient/gym/optIn` (no `?status=confirm`; no persistence). */
  const handleRequestQuote = useCallback(async () => {
    if (!primaryResolved || !primaryMemberPlanId) return;
    if (showSecondary && !secondaryMemberPlanId) return;
    if (!isAccountPrimaryMember(primaryResolved, accountPrimaryMemberId)) {
      toast.error(
        "Gym opt-in is only available for the primary employee account. Select your own profile and try again.",
      );
      return;
    }
    const loc = primaryCityDisplay.trim();
    if (!loc) {
      toast.error("Please choose a location before continuing.");
      return;
    }
    const sub = gymCheck?.subscription_id?.trim();
    const selfRow = apiMemberRows?.find((r) => r.section === "self");
    let name: string;
    let phone: string;
    let email: string;
    if (selfRow) {
      const snap = enrichGymMemberSnapshot(
        buildGymMemberSnapshotFromRow(selfRow, gymCheck),
        gymCheck,
      );
      name = snap.name.trim();
      phone = snap.phone?.trim() || "";
      email =
        snap.email?.trim() || `${name.replaceAll(/\s+/g, "").toLowerCase()}@email.com`;
    } else {
      name = primaryResolved.name.trim();
      phone = primaryResolved.phone?.trim() || "";
      email =
        primaryResolved.email?.trim() ||
        `${name.replaceAll(/\s+/g, "").toLowerCase()}@email.com`;
    }
    if (!phone) {
      toast.error("Phone number is required for gym enrolment.");
      return;
    }

    const body: GymOptInRequest = {
      location: loc,
      package_code: primaryMemberPlanId,
      subscription_id: sub && sub.length > 0 ? sub : null,
      name,
      phone,
      email,
      personal_email: "",
    };

    setQuoteBusy(true);
    try {
      const quote = await postGymOptInQuote(body);
      pendingOptInBodyRef.current = body;
      setAwaitingRazorpayPay(null);
      setQuoteResult(quote);
      setQuoteReviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load price quote");
    } finally {
      setQuoteBusy(false);
    }
  }, [
    primaryResolved,
    primaryMemberPlanId,
    showSecondary,
    secondaryMemberPlanId,
    primaryCityDisplay,
    gymCheck,
    toast,
    apiMemberRows,
    accountPrimaryMemberId,
  ]);

  const closeQuoteReview = useCallback(() => {
    setAwaitingRazorpayPay(null);
    setQuoteReviewOpen(false);
  }, []);

  /** Open Razorpay after user taps Pay now (confirm response already returned payload + invoice). */
  const handlePayNowRazorpay = useCallback(async () => {
    const ctx = awaitingRazorpayPay;
    if (!ctx) return;

    setRazorpayBusy(true);
    try {
      await loadRazorpayScript();
      if (!(globalThis as unknown as { Razorpay?: unknown }).Razorpay) {
        throw new Error("Razorpay Checkout could not load. Check your network or ad blocker.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Razorpay");
      setRazorpayBusy(false);
      return;
    }

    const onPaymentFailed = (failMsg: string) => {
      if (!isPaymentCancelledMessage(failMsg)) {
        toast.error(failMsg);
      }
      setRazorpayBusy(false);
    };

    const onDone = async (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== "object") {
        toast.error("Invalid payment response");
        setRazorpayBusy(false);
        return;
      }
      const paymentId = (detail as Record<string, unknown>).razorpay_payment_id;
      if (typeof paymentId !== "string") {
        toast.error("Invalid payment response");
        setRazorpayBusy(false);
        return;
      }
      try {
        await verifyGymPaymentWithOptionalGateway(ctx.invoiceId, paymentId, onPaymentFailed);
        const refreshed = await getGymCheck();
        writeGymCheckSnapshot(refreshed);
        toast.success("Payment successful");
        setAwaitingRazorpayPay(null);
        setQuoteReviewOpen(false);
        persistOverviewAndNavigate(ctx.confirmResult, true);
      } catch (err) {
        if (err instanceof Error && isPaymentCancelledMessage(err.message)) {
          return;
        }
        toast.error(err instanceof Error ? err.message : "Payment verification failed");
      } finally {
        setRazorpayBusy(false);
      }
    };

    globalThis.window.addEventListener(GYM_PAYMENT_DONE_EVENT, onDone, { once: true });
    openRazorpayCheckoutWithEvent(
      normalizeRazorpayCheckoutPayload({ ...ctx.razorpayPayload }),
      GYM_PAYMENT_DONE_EVENT,
      onPaymentFailed,
    );
  }, [awaitingRazorpayPay, persistOverviewAndNavigate, toast]);

  /** Phase B — confirm: `POST /patient/gym/optIn?status=confirm`, then wallet-only or Pay now + Razorpay. */
  const handleConfirmQuote = useCallback(async () => {
    const body = pendingOptInBodyRef.current;
    if (!body || !quoteResult) return;

    setConfirmBusy(true);
    try {
      const confirmed = await postGymOptInConfirm(body);
      const refreshed = await getGymCheck();
      writeGymCheckSnapshot(refreshed);

      const invoiceId = (confirmed.invoice_id ?? refreshed.order?.invoice_id ?? "").trim();
      const rp = confirmed.razorpay_payload;
      const hasRzp = rp != null && Object.keys(rp).length > 0;
      /** Backend may omit `pending_amount` when amount is only inside `razorpay_payload.amount` (paise). */
      const needsGatewayPay = Boolean(confirmed.payment_required && hasRzp);

      if (confirmed.payment_required && !hasRzp) {
        toast.error("Payment is required but checkout options were not returned.");
        setConfirmBusy(false);
        return;
      }

      if (!needsGatewayPay) {
        toast.success(
          confirmed.message?.trim() || "Your gym registration has been submitted.",
        );
        setQuoteReviewOpen(false);
        setConfirmBusy(false);
        persistOverviewAndNavigate(confirmed, true);
        return;
      }

      if (!invoiceId) {
        toast.error("Missing invoice for payment. Try again from My Orders.");
        setConfirmBusy(false);
        return;
      }

      if (!rp) {
        toast.error("Checkout options missing.");
        setConfirmBusy(false);
        return;
      }

      setAwaitingRazorpayPay({
        invoiceId,
        razorpayPayload: rp,
        confirmResult: confirmed,
      });
      setQuoteResult(confirmed);
      if (confirmed.message?.trim()) {
        toast.success(confirmed.message.trim());
      }
      setConfirmBusy(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm gym enrolment");
      setConfirmBusy(false);
    }
  }, [quoteResult, persistOverviewAndNavigate, toast]);

  const closePackageSheet = useCallback(() => {
    setPackageSheetTarget(null);
  }, []);

  const openPackageSheet = useCallback(
    (target: "primary" | "secondary") => {
      setPackageSheetTarget(target);
      const existing = target === "primary" ? primaryMemberPlanId : secondaryMemberPlanId;
      const fallback = planId ?? displayPlans[0]?.id ?? null;
      setSheetPlanId(existing ?? fallback);
    },
    [primaryMemberPlanId, secondaryMemberPlanId, planId, displayPlans],
  );

  const confirmPackageSheet = useCallback(() => {
    if (!sheetPlanId || !packageSheetTarget) return;
    if (packageSheetTarget === "primary") {
      setPrimaryMemberPlanId(sheetPlanId);
    } else {
      setSecondaryMemberPlanId(sheetPlanId);
    }
    setPackageSheetTarget(null);
  }, [sheetPlanId, packageSheetTarget]);

  useEffect(() => {
    if (!packageSheetTarget && !quoteReviewOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [packageSheetTarget, quoteReviewOpen]);

  useEffect(() => {
    if (!packageSheetTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPackageSheetTarget(null);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [packageSheetTarget]);

  useEffect(() => {
    if (!quoteReviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmBusy) {
        setQuoteReviewOpen(false);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [quoteReviewOpen, confirmBusy]);

  const onCenterList = useCallback(() => {
    navigate(ROUTES.gymMembershipSelectClinic, { state: backState });
  }, [navigate, backState]);

  const confirmRemoveMember = useCallback(() => {
    if (removeConfirmTarget === "primary") {
      clearGymSelectedMemberSnapshot();
      navigate(ROUTES.gymMembershipSelectPeople, { state: backState });
    } else if (removeConfirmTarget === "secondary") {
      const first = readGymSelectedPersonIds()[0];
      if (first) {
        writeGymSelectedPersonIds([first]);
        const row = apiMemberRows?.find((r) => r.id === first);
        if (row) {
          writeGymSelectedMembersSnapshots([
            buildGymMemberSnapshotFromRow(row, gymCheck),
          ]);
        } else {
          const snaps = readGymSelectedMembersSnapshots();
          const keep = snaps.find((s) => s.id === first);
          if (keep) writeGymSelectedMembersSnapshots([keep]);
        }
        setStorageEpoch((e) => e + 1);
      }
    }
    setRemoveConfirmTarget(null);
  }, [removeConfirmTarget, navigate, backState, apiMemberRows, gymCheck]);

  if (!planId || selectedPersonIds.length === 0) {
    return null;
  }

  if (!apiMembersReady) {
    return (
      <div className="gmc-page">
        <header className="hco-top">
          <Link
            to={ROUTES.gymMembershipSelectPeople}
            state={planId ? { planId } : undefined}
            className="hco-back"
            aria-label="Back to member selection"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1 className="hco-title">Gym Membership</h1>
          <span className="hco-top__spacer" aria-hidden />
        </header>
        <main className="gmc-main">
          <p className="gmc-loading-msg" aria-busy="true">
            Loading…
          </p>
        </main>
      </div>
    );
  }

  if (!primaryResolved) {
    return null;
  }

  return (
    <div className="gmc-page">
      <header className="hco-top">
        <Link
          to={ROUTES.gymMembershipSelectPeople}
          state={backState}
          className="hco-back"
          aria-label="Back to member selection"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="hco-title">Gym Membership</h1>
        <span className="hco-top__spacer" aria-hidden />
      </header>

      <main className="gmc-main">
        <div className="gmc-selected-summary" role="status">
          <span className="gmc-selected-summary__label">
            {selectedPersonIds.length} member{selectedPersonIds.length === 1 ? "" : "s"} selected
          </span>
          <span className="gmc-selected-summary__names">
            {primaryResolved.name}
            {secondaryResolved ? ` · ${secondaryResolved.name}` : ""}
          </span>
        </div>
        <div className="gmc-cards">
          <GymMemberConfigureCard
            member={primaryResolved}
            accountPrimaryMemberId={accountPrimaryMemberId}
            cityConfirmed={primaryCityConfirmed}
            cityDisplay={primaryCityDisplay}
            packageChosen={primaryMemberPlanId !== null}
            packageLabel={primaryPackageLabel}
            resolvedPlan={primaryResolvedPlan}
            showClose
            onClose={() => setRemoveConfirmTarget("primary")}
            onChooseCity={() => setPrimaryCity(true)}
            onChoosePackage={() => openPackageSheet("primary")}
            onCenterList={onCenterList}
          />
          {showSecondary && secondaryResolved ? (
            <GymMemberConfigureCard
              member={secondaryResolved}
              accountPrimaryMemberId={accountPrimaryMemberId}
              cityConfirmed={secondaryCityConfirmed}
              cityDisplay={secondaryCityDisplay}
              packageChosen={secondaryMemberPlanId !== null}
              packageLabel={secondaryPackageLabel}
              resolvedPlan={secondaryResolvedPlan}
              showClose
              onClose={() => setRemoveConfirmTarget("secondary")}
              onChooseCity={() => setSecondaryCity(true)}
              onChoosePackage={() => openPackageSheet("secondary")}
              onCenterList={onCenterList}
            />
          ) : null}
        </div>
      </main>

      <footer className="gmc-footer">
        <label className="gmc-terms">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              if (e.target.checked) {
                setTermsSheetOpen(true);
                return;
              }
              setTermsAccepted(false);
            }}
          />
          <span className="gmc-terms__text">
            Please accept all the{" "}
            <button
              type="button"
              className="gmc-terms__link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTermsSheetOpen(true);
              }}
            >
              Terms &amp; Conditions
            </button>
          </span>
        </label>
        <button
          type="button"
          className="gmc-continue"
          disabled={!canContinue || quoteBusy || confirmBusy || razorpayBusy}
          onClick={() => void handleRequestQuote()}
        >
          {quoteBusy ? "Getting quote…" : "Continue"}
        </button>
      </footer>

      {quoteReviewOpen && quoteResult ? (
        <div
          className="gmc-pkg-sheet-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmc-quote-title"
        >
          <button
            type="button"
            className="gmc-pkg-sheet-backdrop"
            aria-label="Close"
            onClick={closeQuoteReview}
          />
          <div className="gmc-quote-sheet">
            <header className="gmc-pkg-sheet__header">
              <h2 id="gmc-quote-title" className="gmc-pkg-sheet__title">
                {awaitingRazorpayPay ? "Complete payment" : "Review payment"}
              </h2>
              <button
                type="button"
                className="gmc-pkg-sheet__close"
                onClick={closeQuoteReview}
                aria-label="Close"
                disabled={confirmBusy}
              >
                ×
              </button>
            </header>
            <div className="gmc-quote-sheet__body">
              {awaitingRazorpayPay ? (
                <>
                  <p className="gmc-quote-sheet__hint gmc-quote-sheet__hint--success">
                    {awaitingRazorpayPay.confirmResult.message?.trim() ||
                      "Your enrolment is ready. Complete payment to finish."}
                  </p>
                  <p className="gmc-quote-sheet__pay-line">
                    Pay securely with Razorpay (UPI, card, netbanking).
                  </p>
                  <dl className="gmc-quote-sheet__dl">
                    <div className="gmc-quote-sheet__row gmc-quote-sheet__row--emph">
                      <dt>Amount to pay</dt>
                      <dd>
                        {(() => {
                          const paise = paiseFromRazorpayPayload(awaitingRazorpayPay.razorpayPayload);
                          return paise != null
                            ? formatPaiseAsRupees(paise)
                            : formatQuoteRupees(awaitingRazorpayPay.confirmResult.pending_amount);
                        })()}
                      </dd>
                    </div>
                    <div className="gmc-quote-sheet__row">
                      <dt>Invoice</dt>
                      <dd className="gmc-quote-sheet__invoice">{awaitingRazorpayPay.invoiceId}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <p className="gmc-quote-sheet__hint">
                    Prices include applicable wallet use per your policy. Confirming creates your invoice and completes
                    registration when no card payment is due.
                  </p>
                  <dl className="gmc-quote-sheet__dl">
                    <div className="gmc-quote-sheet__row">
                      <dt>Full opt-in amount</dt>
                      <dd>{formatQuoteRupees(quoteResult.opt_in_amount)}</dd>
                    </div>
                    <div className="gmc-quote-sheet__row">
                      <dt>Wallet portion (OPD wallet)</dt>
                      <dd>{formatQuoteRupees(quoteResult.opd_paid_amount)}</dd>
                    </div>
                    <div className="gmc-quote-sheet__row">
                      <dt>OPD wallet balance available</dt>
                      <dd>{formatQuoteRupees(quoteResult.opd_wallet_available)}</dd>
                    </div>
                    <div className="gmc-quote-sheet__row gmc-quote-sheet__row--emph">
                      <dt>Amount still due</dt>
                      <dd>{formatQuoteRupees(quoteResult.pending_amount)}</dd>
                    </div>
                    <div className="gmc-quote-sheet__row">
                      <dt>Razorpay needed after confirm</dt>
                      <dd>{quoteExpectsRazorpayGateway(quoteResult) ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                  <p className="gmc-quote-sheet__gate" role="status">
                    {quoteExpectsRazorpayGateway(quoteResult)
                      ? "After you confirm, you’ll complete any remaining amount via Razorpay (card / UPI / netbanking)."
                      : "No card payment expected — your OPD wallet or coverage covers this enrolment once confirmed."}
                  </p>
                  {quoteResult.message?.trim() ? (
                    <p className="gmc-quote-sheet__msg">{quoteResult.message.trim()}</p>
                  ) : null}
                </>
              )}
            </div>
            <footer className="gmc-quote-sheet__footer">
              {awaitingRazorpayPay ? (
                <>
                  <button
                    type="button"
                    className="gmc-quote-sheet__secondary"
                    onClick={() => setAwaitingRazorpayPay(null)}
                    disabled={razorpayBusy}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="gmc-quote-sheet__primary"
                    disabled={razorpayBusy}
                    onClick={() => void handlePayNowRazorpay()}
                  >
                    {razorpayBusy ? "Opening payment…" : "Pay now"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="gmc-quote-sheet__secondary"
                    onClick={closeQuoteReview}
                    disabled={confirmBusy}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="gmc-quote-sheet__primary"
                    disabled={confirmBusy}
                    onClick={() => void handleConfirmQuote()}
                  >
                    {confirmBusy
                      ? "Processing…"
                      : quoteExpectsRazorpayGateway(quoteResult)
                        ? "Confirm & continue"
                        : "Confirm"}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      ) : null}

      {packageSheetTarget ? (
        <div
          className="gmc-pkg-sheet-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmc-pkg-sheet-title"
        >
          <button
            type="button"
            className="gmc-pkg-sheet-backdrop"
            aria-label="Close"
            onClick={closePackageSheet}
          />
          <div className="gmc-pkg-sheet">
            <header className="gmc-pkg-sheet__header">
              <h2 id="gmc-pkg-sheet-title" className="gmc-pkg-sheet__title">
                Select Package
              </h2>
              <button
                type="button"
                className="gmc-pkg-sheet__close"
                onClick={closePackageSheet}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="gmc-pkg-sheet__body">
              <div className="gym-plan-list">
                {displayPlans.map((plan) => {
                  const isChecked = sheetPlanId === plan.id;
                  const selectedClass = isChecked ? " gym-plan-card--selected" : "";
                  const accentClass = planAccentClass(plan.accent);
                  const overlayClass =
                    plan.accent === "blue"
                      ? "gym-plan-card__overlay--blue"
                      : "gym-plan-card__overlay--black";
                  const showStrike = plan.oldPrice > plan.price;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`gym-plan-card${selectedClass}${accentClass}`}
                      onClick={() => setSheetPlanId(plan.id)}
                    >
                      <span
                        className="gym-plan-card__background"
                        style={{ backgroundImage: `url(${plan.image})` }}
                        aria-hidden="true"
                      />
                      <span className={`gym-plan-card__overlay ${overlayClass}`} aria-hidden="true" />
                      <span
                        className={`gym-plan-card__check ${isChecked ? "gym-plan-card__check--active" : ""}`}
                        aria-hidden="true"
                      >
                        {isChecked ? "✔" : ""}
                      </span>
                      <div className="gym-plan-card__content">
                        <div className="gym-plan-card__info">
                          <GymPlanTierHeading plan={plan} />
                          <div className="gym-plan-card__term">{plan.months} Months</div>
                          <div className="gym-plan-card__pricing">
                            {showStrike ? (
                              <del className="gym-plan-card__old-price">
                                ₹{plan.oldPrice.toLocaleString()}+
                              </del>
                            ) : null}
                            <div className="gym-plan-card__price">
                              ₹{plan.price.toLocaleString()}
                              <span className="gym-plan-card__price-suffix">/per person</span>
                            </div>
                            <div className="gym-plan-card__tax-label">{plan.taxFeesLabel}</div>
                          </div>
                        </div>
                      </div>
                      <div className="gym-plan-card__meta mb-4">
                        <button
                          type="button"
                          className="gym-plan-card__benefits"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBenefitsPlan(plan);
                          }}
                        >
                          View Benefits
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <footer className="gmc-pkg-sheet__footer">
              <button
                type="button"
                className="gmc-pkg-sheet__proceed"
                disabled={sheetPlanId === null}
                onClick={confirmPackageSheet}
              >
                Proceed
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <GymBenefitsModal plan={benefitsPlan} onClose={() => setBenefitsPlan(null)} />

      <GymTermsSheet
        open={termsSheetOpen}
        membershipPhrase={termsMembershipPhrase}
        partnerTncHtml={termsPartnerTnc}
        onClose={() => setTermsSheetOpen(false)}
        onAccept={() => setTermsAccepted(true)}
      />

      <GymRemoveMemberConfirmModal
        open={removeConfirmTarget !== null}
        onCancel={() => setRemoveConfirmTarget(null)}
        onConfirm={confirmRemoveMember}
      />
    </div>
  );
}
