import { ROUTES } from "@/constants";
import {
  GYM_OVERVIEW_SNAPSHOT_KEY,
  type GymOverviewBeneficiarySnapshot,
  type GymOverviewSnapshot,
} from "@/constants/gymOverviewStorage";
import { GYM_MEMBERSHIP_PLANS } from "@/constants/gymPlans";
import { GymRemoveMemberConfirmModal } from "@/components/gym/GymRemoveMemberConfirmModal";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./GymMembershipOverviewPage.css";

function readSnapshot(): GymOverviewSnapshot | null {
  try {
    const raw = sessionStorage.getItem(GYM_OVERVIEW_SNAPSHOT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Partial<GymOverviewSnapshot>;
    if (typeof o.planId !== "string" || !o.primary || typeof o.primary.planId !== "string") {
      return null;
    }
    return p as GymOverviewSnapshot;
  } catch {
    return null;
  }
}

function cityLabel(chosen: boolean): string {
  return chosen ? "Hyderabad" : "Indiranagar, Bengaluru";
}

function planForId(id: string) {
  return GYM_MEMBERSHIP_PLANS.find((p) => p.id === id);
}

function formatRupee(n: number): string {
  return `₹ ${n.toLocaleString("en-IN")}`;
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

function CrownBannerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 17l2-8 4 3 4-9 4 9 4-3 2 8H2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

type BeneficiaryCardProps = Readonly<{
  b: GymOverviewBeneficiarySnapshot;
  onRemove: () => void;
  onEditCity: () => void;
  onEdit: () => void;
}>;

function BeneficiaryCard({ b, onRemove, onEditCity, onEdit }: BeneficiaryCardProps) {
  const plan = planForId(b.planId);
  const tierWord = plan?.tier.split(" ")[1] ?? "";
  const isPro = tierWord === "PRO";
  const accentClass = isPro ? "gmo-ben__tier-accent--pro" : "gmo-ben__tier-accent--elite";

  return (
    <article className="gmo-ben">
      <div className="gmo-ben__top">
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
        <div className="gmo-ben__col gmo-ben__col--center">
          {plan ? (
            <>
              <p className="gmo-ben__tier">
                <span className="gmo-ben__tier-muted">Cult </span>
                <span className={`gmo-ben__tier-accent ${accentClass}`}>{tierWord}</span>
              </p>
              <p className="gmo-ben__months">{plan.months} Months</p>
            </>
          ) : null}
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
          b.role === "primary"
            ? "gmo-ben__banner gmo-ben__banner--primary"
            : "gmo-ben__banner gmo-ben__banner--secondary"
        }
      >
        {b.role === "primary" ? <ShieldBannerIcon /> : <CrownBannerIcon />}
        {b.role === "primary" ? "Primary" : "Secondary"}
      </div>
    </article>
  );
}

export function GymMembershipOverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<GymOverviewSnapshot | null>(() => readSnapshot());
  const [removeTarget, setRemoveTarget] = useState<"primary" | "secondary" | null>(null);

  useEffect(() => {
    if (data === null) {
      navigate(ROUTES.gymMembershipConfigure, { replace: true });
    }
  }, [data, navigate]);

  const persist = useCallback((next: GymOverviewSnapshot) => {
    try {
      sessionStorage.setItem(GYM_OVERVIEW_SNAPSHOT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setData(next);
  }, []);

  const payment = useMemo(() => {
    if (!data) return { subtotal: 0, gst: 0, payable: 0, wallet: 0 };
    const ids = [data.primary.planId];
    if (data.secondary) ids.push(data.secondary.planId);
    const subtotal = ids.reduce((sum, id) => {
      const p = planForId(id);
      return sum + (p?.price ?? 0);
    }, 0);
    const wallet = 0;
    const gst = Math.round(subtotal * 0.18);
    const payable = subtotal - wallet + gst;
    return { subtotal, gst, payable, wallet };
  }, [data]);

  const goConfigure = useCallback(() => {
    if (!data) return;
    navigate(ROUTES.gymMembershipConfigure, { state: { planId: data.planId } });
  }, [data, navigate]);

  const confirmRemove = useCallback(() => {
    if (!data || !removeTarget) return;
    if (removeTarget === "primary") {
      try {
        sessionStorage.removeItem(GYM_OVERVIEW_SNAPSHOT_KEY);
      } catch {
        // ignore
      }
      navigate(ROUTES.gymMembershipConfigure, { state: { planId: data.planId } });
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

  if (!data) {
    return null;
  }

  const backState = { planId: data.planId };

  return (
    <div className="gmo-page">
      <header className="gmo-header">
        <Link
          to={ROUTES.gymMembershipConfigure}
          state={backState}
          className="gmo-back"
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
        <div className="gmo-pu-row">
          <PersonIcon className="gmo-pu-ic" />
          {data.primaryUserName}
        </div>
        <div className="gmo-pu-row">
          <MailIcon className="gmo-pu-ic" />
          {data.primaryUserEmail}
        </div>

        <p className="gmo-section-label gmo-section-label--spaced">Beneficiary Details</p>
        <BeneficiaryCard
          b={data.primary}
          onRemove={() => setRemoveTarget("primary")}
          onEditCity={goConfigure}
          onEdit={goConfigure}
        />
        {data.secondary ? (
          <BeneficiaryCard
            b={data.secondary}
            onRemove={() => setRemoveTarget("secondary")}
            onEditCity={goConfigure}
            onEdit={goConfigure}
          />
        ) : null}

        <p className="gmo-note">*Note: Activation will be completed in 72 hours</p>

        <h2 className="gmo-pay-title">Payment Details</h2>
        <div className="gmo-pay-row">
          <span className="gmo-pay-label">Total Amount</span>
          <span className="gmo-pay-value">{formatRupee(payment.subtotal)}</span>
        </div>
        <div className="gmo-pay-row gmo-pay-row--muted">
          <span className="gmo-pay-label">Deducted Amount (from wallet)</span>
          <span className="gmo-pay-value gmo-pay-value--wallet">{formatRupee(payment.wallet)}</span>
        </div>
        <div className="gmo-pay-row">
          <span className="gmo-pay-label">GST</span>
          <span className="gmo-pay-value">{formatRupee(payment.gst)}</span>
        </div>
        <div className="gmo-pay-sep" />
        <div className="gmo-pay-total">
          <span>Payable Amount</span>
          <span>{formatRupee(payment.payable)}</span>
        </div>

        <div className="gmo-remarks">
          <strong>Remarks :</strong> Order cannot be cancelled once confirmed
        </div>
      </main>

      <footer className="gmo-footer">
        <button type="button" className="gmo-pay-btn" onClick={() => navigate(ROUTES.orders)}>
          Click to Pay
        </button>
      </footer>

      <GymRemoveMemberConfirmModal
        open={removeTarget !== null}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
