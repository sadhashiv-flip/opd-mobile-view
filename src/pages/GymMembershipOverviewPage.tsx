import { ROUTES } from "@/constants";
import { GymMembershipOverviewFlowV2 } from "@/components/gym/GymMembershipOverviewFlowV2";
import { readGymFlowV2Overview } from "@/constants/gymFlowV2Storage";
import { getGymCheck } from "@/api/patientGym";
import { readGymCheckSnapshot, writeGymCheckSnapshot } from "@/constants/gymCheckStorage";
import {
  GYM_OVERVIEW_SNAPSHOT_KEY,
  parseGymOverviewSnapshot,
  type GymOverviewBeneficiarySnapshot,
  type GymOverviewSnapshot,
} from "@/constants/gymOverviewStorage";
import { GymRemoveMemberConfirmModal } from "@/components/gym/GymRemoveMemberConfirmModal";
import { resolveGymMembershipPlan } from "@/lib/resolveGymMembershipPlan";
import { Link, useNavigate, generatePath } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import "./GymMembershipOverviewPage.css";

function readSnapshot(): GymOverviewSnapshot | null {
  try {
    const raw = sessionStorage.getItem(GYM_OVERVIEW_SNAPSHOT_KEY);
    if (!raw) return null;
    return parseGymOverviewSnapshot(raw);
  } catch {
    return null;
  }
}

function cityLabel(chosen: boolean): string {
  return chosen ? "Hyderabad" : "Indiranagar, Bengaluru";
}

type GymCheckSnapshot = ReturnType<typeof readGymCheckSnapshot>;

function formatRupee(n: number): string {
  return `₹ ${n.toLocaleString("en-IN")}`;
}

/** GST (18%) already included in a tax-inclusive total: GST portion = total × 18/118. */
function gstAmountFromInclusiveTotal(totalInclGst: number): number {
  if (totalInclGst <= 0) return 0;
  return Math.round((totalInclGst * 18) / 118);
}

/** Overview can show stored opt-in totals; otherwise send the user to `/order/gym/:invoiceId`. */
function gymOverviewHasServerPaymentRows(sp: GymOverviewSnapshot["serverPayment"]): boolean {
  if (!sp || typeof sp !== "object") return false;
  return (
    [
      sp.opt_in_amount,
      sp.pending_amount,
      sp.opd_paid_amount,
      sp.opd_wallet_available,
    ].some((x) => x != null && typeof x === "number" && Number.isFinite(x))
  );
}

function PersonIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 20c0-4 3.5-7 7-7s7 3 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldBannerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

type BeneficiaryCardProps = Readonly<{
  b: GymOverviewBeneficiarySnapshot;
  gymCheck: GymCheckSnapshot;
  onRemove: () => void;
  onEditCity: () => void;
  onEdit: () => void;
}>;

function BeneficiaryCard({ b, gymCheck, onRemove, onEditCity, onEdit }: BeneficiaryCardProps) {
  const plan = resolveGymMembershipPlan(b.planId, gymCheck);
  const tierWord = plan?.tier.split(" ")[1] ?? "";
  const isPro = tierWord === "PRO";
  const accentClass = isPro ? "gmo-ben__tier-accent--pro" : "gmo-ben__tier-accent--elite";
  const borderClass = b.isAccountPrimary ? "gmo-ben--account-primary" : "gmo-ben--account-dependent";

  return (
    <article className={`gmo-ben ${borderClass}`}>
      {plan ? (
        <div className="gmo-ben__package">
          <p className="gmo-ben__tier">
            {plan.cardTitle ? (
              <span className={`gmo-ben__tier-accent ${accentClass}`}>{plan.cardTitle}</span>
            ) : (
              <>
                <span className="gmo-ben__tier-muted">Cult </span>
                <span className={`gmo-ben__tier-accent ${accentClass}`}>{tierWord}</span>
              </>
            )}
          </p>
          <p className="gmo-ben__months">{plan.months} Months</p>
        </div>
      ) : null}
      <div className="gmo-ben__main">
        <div className="gmo-ben__col gmo-ben__col--left">
          <div className="gmo-ben__row">
            <span className="gmo-ben__k">Name</span>
            <span className="gmo-ben__sep" aria-hidden="true">
              :
            </span>
            <span className="gmo-ben__v">{b.name}</span>
          </div>
          <div className="gmo-ben__row">
            <span className="gmo-ben__k">Phone</span>
            <span className="gmo-ben__sep" aria-hidden="true">
              :
            </span>
            <span className="gmo-ben__v">{b.phone}</span>
          </div>
          <div className="gmo-ben__row">
            <span className="gmo-ben__k">Email</span>
            <span className="gmo-ben__sep" aria-hidden="true">
              :
            </span>
            <span className="gmo-ben__v">{b.email}</span>
          </div>
          <div className="gmo-ben__row">
            <span className="gmo-ben__k">City</span>
            <span className="gmo-ben__sep" aria-hidden="true">
              :
            </span>
            <span className="gmo-ben__city-edit">
              <span className="gmo-ben__v">{cityLabel(b.cityChosen)}</span>
              <button
                type="button"
                className="gmo-ben__pencil"
                aria-label="Edit city"
                onClick={onEditCity}
              >
                <PencilIcon />
              </button>
            </span>
          </div>
        </div>
        <div className="gmo-ben__col gmo-ben__col--right">
          {plan ? (
            <>
              <p className="gmo-ben__price">{formatRupee(plan.price)}</p>
              <p className="gmo-ben__tax">{plan.taxFeesLabel}</p>
            </>
          ) : null}
          <div className="gmo-ben__actions">
            <button type="button" className="gmo-ben__action gmo-ben__action--remove" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="gmo-ben__action gmo-ben__action--edit" onClick={onEdit}>
              Edit
            </button>
          </div>
        </div>
      </div>
      <div
        className={
          b.isAccountPrimary
            ? "gmo-ben__banner gmo-ben__banner--account-primary"
            : "gmo-ben__banner gmo-ben__banner--account-dependent"
        }
      >
        <ShieldBannerIcon />
        {b.isAccountPrimary ? "Primary" : "Dependent"}
      </div>
    </article>
  );
}

export function GymMembershipOverviewPage() {
  const navigate = useNavigate();
  const gymFlowV2 = useMemo(() => readGymFlowV2Overview(), []);
  const [data, setData] = useState<GymOverviewSnapshot | null>(() => readSnapshot());
  const [removeTarget, setRemoveTarget] = useState<"primary" | "secondary" | null>(null);
  const [liveGymCheck, setLiveGymCheck] = useState(() => readGymCheckSnapshot());

  useEffect(() => {
    let cancelled = false;
    void getGymCheck()
      .then((next) => {
        writeGymCheckSnapshot(next);
        if (!cancelled) setLiveGymCheck(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const gymCheck = liveGymCheck;

  const enableWallet = useMemo(() => {
    if (!data || !gymCheck) return false;
    const pkg = gymCheck.packages.find((p) => p.package_code === data.planId);
    return pkg?.enable_wallet ?? false;
  }, [data, gymCheck]);

  useEffect(() => {
    if (gymFlowV2) return;
    if (data === null) {
      navigate(ROUTES.gymMembership, { replace: true });
    }
  }, [data, navigate, gymFlowV2]);

  /** No stored Phase B amounts but we have an invoice — payment lives on order detail. */
  useLayoutEffect(() => {
    if (gymFlowV2) return;
    if (!data) return;
    if (data.registrationComplete) return;
    if (gymOverviewHasServerPaymentRows(data.serverPayment)) return;
    const invoiceId =
      data.gymInvoiceId?.trim() ||
      gymCheck?.order?.invoice_id?.trim() ||
      "";
    if (!invoiceId) return;
    navigate(
      generatePath(ROUTES.ordersDetail, { orderKind: "gym", invoiceId }),
      { replace: true },
    );
  }, [data, gymCheck?.order?.invoice_id, navigate, gymFlowV2]);

  const persist = useCallback((next: GymOverviewSnapshot) => {
    try {
      sessionStorage.setItem(GYM_OVERVIEW_SNAPSHOT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setData(next);
  }, []);

  const payment = useMemo(() => {
    if (!data) return { totalInclGst: 0, gstIncluded: 0, payable: 0, wallet: 0, fromServer: false };
    const sp = data.serverPayment;
    if (sp) {
      const totalInclGst = sp.opt_in_amount ?? 0;
      const wallet = sp.opd_paid_amount ?? 0;
      const payable = sp.pending_amount ?? 0;
      const gstIncluded = gstAmountFromInclusiveTotal(totalInclGst);
      return { totalInclGst, gstIncluded, payable, wallet, fromServer: true as const };
    }
    const ids = [data.primary.planId];
    if (data.secondary) ids.push(data.secondary.planId);
    const totalInclGst = ids.reduce((sum, id) => {
      const p = resolveGymMembershipPlan(id, gymCheck);
      return sum + (p?.price ?? 0);
    }, 0);
    const gstIncluded = gstAmountFromInclusiveTotal(totalInclGst);
    const wallet = enableWallet ? totalInclGst : 0;
    const payable = totalInclGst - wallet;
    return { totalInclGst, gstIncluded, payable, wallet, fromServer: false as const };
  }, [data, gymCheck, enableWallet]);

  const goConfigure = useCallback(() => {
    if (!data) return;
    navigate(ROUTES.gymMembership, { state: { planId: data.planId } });
  }, [data, navigate]);

  const confirmRemove = useCallback(() => {
    if (!data || !removeTarget) return;
    if (removeTarget === "primary") {
      try {
        sessionStorage.removeItem(GYM_OVERVIEW_SNAPSHOT_KEY);
      } catch {
        // ignore
      }
      navigate(ROUTES.gymMembership, { state: { planId: data.planId } });
    } else {
      const next: GymOverviewSnapshot = {
        ...data,
        showSecondary: false,
        secondary: null,
      };
      persist(next);
    }
    setRemoveTarget(null);
  }, [data, removeTarget, navigate, persist]);

  if (gymFlowV2) {
    return <GymMembershipOverviewFlowV2 />;
  }

  if (!data) {
    return null;
  }

  const backState = { planId: data.planId };

  return (
    <div className="gmo-page">
      <header className="gmo-header">
        <Link
          to={ROUTES.gymMembership}
          state={backState}
          className="app-back-btn gmo-back"
          aria-label="Back"
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
        <h1 className="gmo-title">Overview</h1>
      </header>

      <main className="gmo-main">
        <p className="gmo-section-label">Primary User</p>
        <div className="gmo-pu-block">
          <div className="gmo-pu-row gmo-pu-row--name">
            <PersonIcon className="gmo-pu-ic" aria-hidden />
            <span className="gmo-pu-name">{data.accountPrimaryUser.name}</span>
          </div>
          <div className="gmo-pu-row gmo-pu-row--contact" aria-label="Email and phone">
            <MailIcon className="gmo-pu-ic gmo-pu-ic--contact" aria-hidden />
            <span className="gmo-pu-contact">
              <span className="gmo-pu-email">{data.accountPrimaryUser.email}</span>
              <span className="gmo-pu-divider" aria-hidden="true">
                |
              </span>
              <span className="gmo-pu-phone">{data.accountPrimaryUser.phone}</span>
            </span>
          </div>
        </div>

        {gymCheck?.subscription_id ? (
          <p className="gmo-subscription-id">Subscription ID: {gymCheck.subscription_id}</p>
        ) : null}

        {gymCheck?.order ? (
          <p className="gmo-order-ref">
            Order invoice: {gymCheck.order.invoice_id}
            {gymCheck.order.details?.location ? ` · ${gymCheck.order.details.location}` : ""}
          </p>
        ) : null}

        <p className="gmo-section-label gmo-section-label--spaced">Beneficiary Details</p>
        <BeneficiaryCard
          b={data.primary}
          gymCheck={gymCheck}
          onRemove={() => setRemoveTarget("primary")}
          onEditCity={goConfigure}
          onEdit={goConfigure}
        />
        {data.secondary ? (
          <BeneficiaryCard
            b={data.secondary}
            gymCheck={gymCheck}
            onRemove={() => setRemoveTarget("secondary")}
            onEditCity={goConfigure}
            onEdit={goConfigure}
          />
        ) : null}

        <p className="gmo-note">*Note: Activation will be completed in 72 hours</p>

        <h2 className="gmo-pay-title">Payment Details</h2>
        <div className="gmo-pay-row">
          <span className="gmo-pay-label">Total Amount</span>
          <span className="gmo-pay-value">{formatRupee(payment.totalInclGst)}</span>
        </div>
        <div className="gmo-pay-row gmo-pay-row--muted">
          <span className="gmo-pay-label">
            {payment.fromServer ? "Wallet applied (OPD)" : "Deducted Amount (from wallet)"}
          </span>
          <span className="gmo-pay-value gmo-pay-value--wallet">{formatRupee(payment.wallet)}</span>
        </div>
        <div className="gmo-pay-row">
          <span className="gmo-pay-label">GST (included in total)</span>
          <span className="gmo-pay-value">{formatRupee(payment.gstIncluded)}</span>
        </div>
        <div className="gmo-pay-sep" />
        <div className="gmo-pay-total">
          <span>Payable Amount</span>
          <span>{formatRupee(payment.payable)}</span>
        </div>

        <div className="gmo-remarks">
          <strong>Remarks :</strong> Order cannot be cancelled once confirmed
        </div>

        {data.registrationComplete ? (
          <p className="gmo-payment-gate" role="status">
            Payment for this enrolment was completed during checkout. Activation is processed per your employer&apos;s
            timeline.
          </p>
        ) : null}
      </main>

      <footer className="gmo-footer">
        <Link to={ROUTES.orders} className="gmo-pay-btn">
          View my orders
        </Link>
      </footer>

      <GymRemoveMemberConfirmModal
        open={removeTarget !== null}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
