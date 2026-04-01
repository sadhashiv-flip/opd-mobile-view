import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { GymBenefitsModal } from "@/components/gym/GymBenefitsModal";
import { GYM_MEMBERSHIP_PLANS, type GymMembershipPlan } from "@/constants/gymPlans";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import "./GymMembershipPage.css";
import "./HealthCheckupsOverviewPage.css";

function planAccentClass(accent: (typeof GYM_MEMBERSHIP_PLANS)[number]["accent"]): string {
  if (accent === "gold") return " gym-plan-card--gold";
  if (accent === "orange") return " gym-plan-card--orange";
  return " gym-plan-card--blue";
}

export function GymMembershipPage() {
  const [checkedPlanId, setCheckedPlanId] = useState<string | null>(null);
  const [benefitsPlan, setBenefitsPlan] = useState<GymMembershipPlan | null>(null);
  const navigate = useNavigate();

  const selectedPlan = useMemo(
    () => GYM_MEMBERSHIP_PLANS.find((plan) => plan.id === checkedPlanId) ?? null,
    [checkedPlanId],
  );

  const canContinue = checkedPlanId !== null;

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
        <div className="gym-plan-list">
          {GYM_MEMBERSHIP_PLANS.map((plan) => {
            const isChecked = checkedPlanId === plan.id;
            const selectedClass = isChecked ? " gym-plan-card--selected" : "";
            const accentClass = planAccentClass(plan.accent);
            const overlayClass =
              plan.accent === "blue" ? "gym-plan-card__overlay--blue" : "gym-plan-card__overlay--black";
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
                    <div className="gym-plan-card__tier">
                      <span className="gym-plan-card__tier-text">Cult</span>
                      <span className="gym-plan-card__tier-highlight">
                        {plan.tier.split(" ")[1]}
                      </span>
                      <span className="gym-plan-card__tier-text">Membership</span>
                    </div>
                    <div className="gym-plan-card__term">{plan.months} Months</div>
                    <div className="gym-plan-card__pricing">
                      <del className="gym-plan-card__old-price">₹{plan.oldPrice.toLocaleString()}+</del>
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
      </main>

      <footer className="gym-continue-footer">
        <button
          type="button"
          className={`gym-continue-button${canContinue ? "" : " gym-continue-button--disabled"}`}
          onClick={() => {
            if (!canContinue || !selectedPlan) return;
            try {
              localStorage.setItem("opd-mobile-view.gym-membership.planId", selectedPlan.id);
            } catch {
              // ignore storage errors
            }
            navigate(ROUTES.gymMembershipSelectPeople, { state: { planId: selectedPlan.id } });
          }}
          disabled={!canContinue}
        >
          Continue
        </button>
      </footer>

      <GymBenefitsModal plan={benefitsPlan} onClose={() => setBenefitsPlan(null)} />
    </div>
  );
}
