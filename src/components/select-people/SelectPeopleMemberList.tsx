import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import { SubscriptionActivateCtaButton } from "@/components/select-people/SubscriptionActivateCtaButton";
import { SelectPeopleSelectionHint } from "@/components/select-people/SelectPeopleSelectionHint";
import {
  HC_PERSON_ADD_CTA_DISABLED_TOOLTIP,
  HC_PERSON_ADD_CTA_TOOLTIP,
  HC_PERSON_NOT_ACTIVATED_CTA_TOOLTIP,
  memberShowsSubscriptionActivateCta,
  MEMBER_NOT_ACTIVATED_LABEL,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";
import { memberRowSubtitle, type SelectPeopleHint } from "@/lib/selectPeopleShared";

export type SelectPeopleMemberListConfig = Readonly<{
  showAhcSponsorSubtitle: boolean;
  restrictToAhcSelection: boolean;
  isDiagnosticsFlow: boolean;
}>;

type SelectPeopleMemberListProps = Readonly<{
  members: GymMemberListRow[];
  selectedIds: string[];
  onToggle: (memberId: string) => void;
  onNavigateSubscriptions: () => void;
  config: SelectPeopleMemberListConfig;
  selectionHint: SelectPeopleHint | null;
  canAddFamily: boolean;
  hideAddFamily?: boolean;
  returnPath: string;
  /** When set, called instead of navigating directly (e.g. bottom sheets close first). */
  onAddFamily?: () => void;
}>;

export function SelectPeopleMemberList({
  members,
  selectedIds,
  onToggle,
  onNavigateSubscriptions,
  config,
  selectionHint,
  canAddFamily,
  hideAddFamily = false,
  returnPath,
  onAddFamily,
}: SelectPeopleMemberListProps) {
  const navigate = useNavigate();

  const renderTrailing = (member: GymMemberListRow, rowDisabled: boolean) => {
    const isSelected = selectedIds.includes(member.id);
    if (isSelected) {
      return (
        <span className="hc-person__cta hc-person__cta--added" aria-hidden="true">
          <img src={selectSvg} alt="" width={18} height={18} draggable={false} />
        </span>
      );
    }
    if (memberShowsSubscriptionActivateCta(member)) {
      return <SubscriptionActivateCtaButton onClick={onNavigateSubscriptions} />;
    }
    const ctaLabel = !member.isSubscribed ? MEMBER_NOT_ACTIVATED_LABEL : "Add";
    const addTitle =
      member.isSubscribed && !rowDisabled
        ? HC_PERSON_ADD_CTA_TOOLTIP
        : member.isSubscribed && rowDisabled
          ? HC_PERSON_ADD_CTA_DISABLED_TOOLTIP
          : undefined;
    return (
      <span
        className={`hc-person__cta${rowDisabled ? " hc-person__cta--disabled" : ""}`}
        aria-hidden="true"
        title={ctaLabel === "Add" ? addTitle : HC_PERSON_NOT_ACTIVATED_CTA_TOOLTIP}
      >
        {ctaLabel}
      </span>
    );
  };

  const renderMemberRow = (member: GymMemberListRow) => {
    const canSubActivate = memberShowsSubscriptionActivateCta(member);
    const ageBlocked = config.isDiagnosticsFlow && member.isChildBlocked;
    const notActivated = !member.isSubscribed;
    const rowDisabled =
      ageBlocked ||
      notActivated ||
      (config.isDiagnosticsFlow &&
        config.restrictToAhcSelection &&
        !member.ahcAvailable);
    const subtitle = memberRowSubtitle(member, {
      showAhcSponsorSubtitle: config.showAhcSponsorSubtitle,
    });
    const showInactiveTag =
      !config.isDiagnosticsFlow && notActivated && !canSubActivate && !ageBlocked;
    const rowClass = `hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}${rowDisabled && !canSubActivate ? " hc-person--disabled" : ""}${canSubActivate ? " hc-person--subscription-activate" : ""}`;
    const body = (
      <>
        <span className="hc-person__avatar" aria-hidden="true">
          <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
        </span>
        <span className="hc-person__info">
          <span className="hc-person__name">{member.name}</span>
          {showInactiveTag ? (
            <span className="hc-person__tag hc-person__tag--inactive">{MEMBER_NOT_ACTIVATED_LABEL}</span>
          ) : null}
          <span
            className={`hc-person__sub${ageBlocked || (notActivated && !canSubActivate) ? " hc-person__sub--muted" : config.showAhcSponsorSubtitle && member.ahcAvailable ? " hc-person__sub--sponsored" : ""}`}
          >
            {subtitle}
          </span>
        </span>
        {renderTrailing(member, rowDisabled)}
      </>
    );
    if (canSubActivate) {
      return (
        <div key={member.id} className={rowClass}>
          {body}
        </div>
      );
    }
    return (
      <button
        key={member.id}
        type="button"
        disabled={rowDisabled}
        className={rowClass}
        onClick={() => onToggle(member.id)}
      >
        {body}
      </button>
    );
  };

  const handleAddFamily = () => {
    if (onAddFamily) {
      onAddFamily();
      return;
    }
    navigate(ROUTES.profileMembersAdd, {
      state: { returnPath },
    });
  };

  return (
    <>
      <SelectPeopleSelectionHint hint={selectionHint} />
      <section className="hc-block hc-block--flat-members">
        {members.map(renderMemberRow)}
        {!hideAddFamily && canAddFamily ? (
          <button type="button" className="hc-add-family" onClick={handleAddFamily}>
            <span className="hc-add-family__ic" aria-hidden="true">
              +
            </span>
            <span> Add new family member</span>
          </button>
        ) : null}
      </section>
    </>
  );
}
