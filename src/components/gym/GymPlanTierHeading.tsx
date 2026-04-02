import type { GymMembershipPlan } from "@/constants/gymPlans";

type GymPlanTierHeadingProps = Readonly<{
  plan: GymMembershipPlan;
}>;

export function GymPlanTierHeading({ plan }: GymPlanTierHeadingProps) {
  if (plan.cardTitle) {
    return (
      <div className="gym-plan-card__tier gym-plan-card__tier--package-title">
        <span className="gym-plan-card__tier-highlight gym-plan-card__tier-highlight--package">
          {plan.cardTitle}
        </span>
      </div>
    );
  }

  const tierWord = plan.tier.split(" ")[1] ?? "";
  return (
    <div className="gym-plan-card__tier">
      <span className="gym-plan-card__tier-text">Cult</span>
      <span className="gym-plan-card__tier-highlight">{tierWord}</span>
      <span className="gym-plan-card__tier-text">Membership</span>
    </div>
  );
}
