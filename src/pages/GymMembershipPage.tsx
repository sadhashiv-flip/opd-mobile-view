import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import type { GymCheckData } from "@/api/patientGym";
import { getGymCheck } from "@/api/patientGym";
import { GymBenefitsModal } from "@/components/gym/GymBenefitsModal";
import { GymPlanTierHeading } from "@/components/gym/GymPlanTierHeading";
import { writeGymCheckSnapshot, readGymCheckSnapshot } from "@/constants/gymCheckStorage";
import { ROUTES } from "@/constants";
import { GYM_MEMBERSHIP_PLANS, type GymMembershipPlan } from "@/constants/gymPlans";
import { gymPackageToMembershipPlan } from "@/lib/gymPackageToPlan";
import { useToast } from "@/hooks/useToast";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import "./GymMembershipPage.css";
import "./HealthCheckupsOverviewPage.css";

function planAccentClass(accent: GymMembershipPlan["accent"]): string {
  if (accent === "gold") return " gym-plan-card--gold";
  if (accent === "orange") return " gym-plan-card--orange";
  return " gym-plan-card--blue";
}

export function GymMembershipPage() {
  const [checkedPlanId, setCheckedPlanId] = useState<string | null>(null);
  const [benefitsPlan, setBenefitsPlan] = useState<GymMembershipPlan | null>(null);
  const [gymCheck, setGymCheck] = useState<GymCheckData | null>(() => readGymCheckSnapshot());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await getGymCheck();
        if (cancelled) return;
        writeGymCheckSnapshot(data);
        setGymCheck(data);
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Could not verify gym access");
        setGymCheck(readGymCheckSnapshot());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, location.key]);

  const displayPlans = useMemo((): readonly GymMembershipPlan[] => {
    if (gymCheck?.packages.length) {
      return gymCheck.packages.map((p, i) => gymPackageToMembershipPlan(p, i));
    }
    return GYM_MEMBERSHIP_PLANS;
  }, [gymCheck]);

  const selectedPlan = useMemo(
    () => displayPlans.find((plan) => plan.id === checkedPlanId) ?? null,
    [displayPlans, checkedPlanId],
  );

  const canContinue = checkedPlanId !== null;

  const blockedByModule = gymCheck !== null && !gymCheck.gym_module;
  const hasExistingOrder = Boolean(gymCheck?.order);
  const noPackages =
    gymCheck !== null && gymCheck.gym_module && gymCheck.packages.length === 0 && !loading;

  return (
    <div className="gym-membership-page">
      <header className="hco-top">
        <Link to={ROUTES.services} className="hco-back" aria-label="Back to services">
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
        <Link to={ROUTES.orders} className="hco-orders">
          <span className="hco-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          My Orders
        </Link>
      </header>

      <main className="gym-membership-main">
        {gymCheck?.subscription_id ? (
          <p className="gym-membership-meta" aria-live="polite">
            Subscription ID: {gymCheck.subscription_id}
          </p>
        ) : null}

        {gymCheck?.order ? (
          <div className="gym-membership-order-banner">
            <p className="gym-membership-order-banner__title">Existing order</p>
            <p className="gym-membership-order-banner__line">
              Invoice: {gymCheck.order.invoice_id}
              {gymCheck.order.details?.location ? ` · ${gymCheck.order.details.location}` : ""}
            </p>
            <p className="gym-membership-order-banner__line">Status code: {gymCheck.order.status}</p>
          </div>
        ) : null}

        {loading ? (
          <p className="gym-membership-loading" aria-busy="true">
            Loading plans…
          </p>
        ) : null}

        {!loading && blockedByModule ? (
          <p className="gym-membership-empty">Gym membership is not available for your account.</p>
        ) : null}

        {!loading && !blockedByModule && hasExistingOrder ? (
          <p className="gym-membership-empty" role="status">
            You already have a gym enrolment order. Check My Orders or wait for activation instructions.
          </p>
        ) : null}

        {!loading && noPackages ? (
          <p className="gym-membership-empty">No membership packages are available right now.</p>
        ) : null}

        {!loading && !blockedByModule && !hasExistingOrder && !noPackages ? (
          <div className="gym-plan-list">
            {displayPlans.map((plan) => {
              const isChecked = checkedPlanId === plan.id;
              const selectedClass = isChecked ? " gym-plan-card--selected" : "";
              const accentClass = planAccentClass(plan.accent);
              const overlayClass =
                plan.accent === "blue" ? "gym-plan-card__overlay--blue" : "gym-plan-card__overlay--black";
              const showStrike = plan.oldPrice > plan.price;
              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`gym-plan-card${selectedClass}${accentClass}`}
                  onClick={() => setCheckedPlanId((prev) => (prev === plan.id ? null : plan.id))}
                >
                  <span
                    className="gym-plan-card__background"
                    style={{ backgroundImage: `url(${plan.image})` }}
                    aria-hidden="true"
                  />
                  <span className={`gym-plan-card__overlay ${overlayClass}`} aria-hidden="true" />
                  <button
                    type="button"
                    className={`gym-plan-card__check ${isChecked ? "gym-plan-card__check--active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCheckedPlanId((prev) => (prev === plan.id ? null : plan.id));
                    }}
                    aria-label={isChecked ? "Deselect plan" : "Select plan"}
                  >
                    {isChecked ? "✔" : ""}
                  </button>
                  <div className="gym-plan-card__content">
                    <div className="gym-plan-card__info">
                      <GymPlanTierHeading plan={plan} />
                      <div className="gym-plan-card__term">{plan.months} Months</div>
                      <div className="gym-plan-card__pricing">
                        {showStrike ? (
                          <del className="gym-plan-card__old-price">₹{plan.oldPrice.toLocaleString()}+</del>
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
        ) : null}
      </main>

      <footer className="gym-continue-footer">
        <button
          type="button"
          className={`gym-continue-button${canContinue && !blockedByModule && !hasExistingOrder && !noPackages ? "" : " gym-continue-button--disabled"}`}
          onClick={() => {
            if (!canContinue || !selectedPlan || blockedByModule || hasExistingOrder || noPackages) return;
            try {
              localStorage.setItem("opd-mobile-view.gym-membership.planId", selectedPlan.id);
            } catch {
              // ignore storage errors
            }
            navigate(ROUTES.gymMembershipSelectPeople, { state: { planId: selectedPlan.id } });
          }}
          disabled={!canContinue || blockedByModule || hasExistingOrder || noPackages || loading}
        >
          Continue
        </button>
      </footer>

      <GymBenefitsModal plan={benefitsPlan} onClose={() => setBenefitsPlan(null)} />
    </div>
  );
}
