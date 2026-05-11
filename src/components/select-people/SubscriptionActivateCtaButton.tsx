import {
  HC_PERSON_ACTIVATE_CTA_TOOLTIP,
  MEMBER_SUBSCRIPTION_ACTIVATE_LABEL,
} from "@/lib/gymMemberDisplay";

type Props = Readonly<{
  onClick: () => void;
}>;

/** Tappable CTA for inactive members when a plan reports `canActivate`. */
export function SubscriptionActivateCtaButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className="hc-person__cta hc-person__cta--activate"
      title={HC_PERSON_ACTIVATE_CTA_TOOLTIP}
      aria-label={HC_PERSON_ACTIVATE_CTA_TOOLTIP}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {MEMBER_SUBSCRIPTION_ACTIVATE_LABEL}
    </button>
  );
}
