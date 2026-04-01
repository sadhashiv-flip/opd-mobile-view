import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { GYM_IMAGES } from "@/assets/images/gym";
import "./GymMembershipPage.css";

type Plan = Readonly<{
  id: string;
  tier: string;
  months: number;
  oldPrice: number;
  price: number;
  perPerson: string;
  bannerColor: string;
  badgeText: string;
  accent: "orange" | "blue";
  image: string;
}>;

const PLANS: readonly Plan[] = [
  {
    id: "elite-12",
    tier: "Cult ELITE",
    months: 12,
    oldPrice: 15000,
    price: 11000,
    perPerson: "per person",
    bannerColor: "#1f141f",
    badgeText: "Membership",
    accent: "orange",
    image: GYM_IMAGES.elite12,
  },
  {
    id: "elite-9",
    tier: "Cult ELITE",
    months: 9,
    oldPrice: 12000,
    price: 9000,
    perPerson: "per person",
    bannerColor: "#21151b",
    badgeText: "Membership",
    accent: "orange",
    image: GYM_IMAGES.elite9,
  },
  {
    id: "pro-6",
    tier: "Cult PRO",
    months: 6,
    oldPrice: 10000,
    price: 6000,
    perPerson: "per person",
    bannerColor: "#03103f",
    badgeText: "Membership",
    accent: "blue",
    image: GYM_IMAGES.pro6,
  },
];

export function GymMembershipPage() {
  const [checkedPlanId, setCheckedPlanId] = useState<string | null>(null);
  const navigate = useNavigate();

  const selectedPlan = useMemo(
    () => PLANS.find((plan) => plan.id === checkedPlanId) ?? null,
    [checkedPlanId],
  );

  const canContinue = checkedPlanId !== null;

  return (
    <div className="gym-membership-page">
      <header className="gym-membership-header">
        <button
          type="button"
          className="gym-back-button"
          onClick={() => navigate(ROUTES.services)}
          aria-label="Back"
        >
          ←
        </button>
        <h1>Gym Membership</h1>
      </header>

      <main className="gym-membership-main">
        <div className="gym-plan-list">
          {PLANS.map((plan) => {
            const isChecked = checkedPlanId === plan.id;
            const selectedClass = isChecked ? " gym-plan-card--selected" : "";
            const accentClass = plan.accent === "orange" ? " gym-plan-card--orange" : " gym-plan-card--blue";
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
                <span
                  className={`gym-plan-card__overlay ${plan.accent === "orange" ? "gym-plan-card__overlay--black" : "gym-plan-card__overlay--blue"}`}
                  aria-hidden="true"
                />
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
                    <div className="gym-plan-card__term">
                      {plan.months} Months
                    </div>
                    <div className="gym-plan-card__pricing">
                      <del className="gym-plan-card__old-price">₹{plan.oldPrice.toLocaleString()}+</del>
                      <div className="gym-plan-card__price">
                        ₹{plan.price.toLocaleString()}
                        <span className="gym-plan-card__price-suffix">/per person</span>
                      </div>
                      <div className="gym-plan-card__tax-label">(+1280 taxes & fees)</div>
                    </div>
                  </div>
                </div>
                <div className="gym-plan-card__meta mb-4">
                  <span className="gym-plan-card__benefits">View Benefits</span>
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
            if (canContinue && selectedPlan) {
              alert(`Continue with ${selectedPlan.tier} (${selectedPlan.months} months)`);
            }
          }}
          disabled={!canContinue}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
