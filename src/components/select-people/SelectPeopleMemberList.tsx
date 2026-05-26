import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import { SelectPeopleAddedCta } from "@/components/select-people/SelectPeopleAddedCta";
import { SubscriptionActivateCtaButton } from "@/components/select-people/SubscriptionActivateCtaButton";
import {
  HC_PERSON_ADD_CTA_DISABLED_TOOLTIP,
  HC_PERSON_ADD_CTA_TOOLTIP,
  memberShowsSubscriptionActivateCta,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";
import { selectPeopleMemberLine } from "@/lib/selectPeopleShared";

export type SelectPeopleMemberListConfig = Readonly<{
  showAhcSponsorSubtitle: boolean;
  restrictToAhcSelection: boolean;
  isDiagnosticsFlow: boolean;
  /**
   * When true (dental, vision), no age gate; members remain selectable per subscription rules.
   */
  relaxMemberRestrictions: boolean;
}>;

/** Primary profile first; preserve API order within each group. */
function sortSelectPeopleMembers(rows: readonly GymMemberListRow[]): GymMemberListRow[] {
  return [...rows].sort((a, b) => {
    if (a.section === "self" && b.section !== "self") return -1;
    if (b.section === "self" && a.section !== "self") return 1;
    return 0;
  });
}

type SelectPeopleMemberListProps = Readonly<{
  members: GymMemberListRow[];
  selectedIds: string[];
  onToggle: (memberId: string) => void;
  onNavigateSubscriptions: () => void;
  config: SelectPeopleMemberListConfig;
  canAddFamily: boolean;
  hideAddFamily?: boolean;
  returnPath: string;
  onAddFamily?: () => void;
}>;

export function SelectPeopleMemberList({
  members,
  selectedIds,
  onToggle,
  onNavigateSubscriptions,
  config,
  canAddFamily,
  hideAddFamily = false,
  returnPath,
  onAddFamily,
}: SelectPeopleMemberListProps) {
  const navigate = useNavigate();

  const displayMembers = useMemo(
    () => sortSelectPeopleMembers(members),
    [members],
  );

  const renderTrailing = (member: GymMemberListRow, rowDisabled: boolean) => {
    const isRelaxed = config.relaxMemberRestrictions;
    if (!isRelaxed && member.isChildBlocked) {
      return null;
    }
    if (selectedIds.includes(member.id)) {
      return <SelectPeopleAddedCta />;
    }
    if (memberShowsSubscriptionActivateCta(member)) {
      return <SubscriptionActivateCtaButton onClick={onNavigateSubscriptions} />;
    }
    if (!member.isSubscribed && !isRelaxed) {
      return null;
    }
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
        title={addTitle}
      >
        Add
      </span>
    );
  };

  const renderMemberRow = (member: GymMemberListRow) => {
    const isRelaxed = config.relaxMemberRestrictions;
    const canSubActivate = memberShowsSubscriptionActivateCta(member);
    const notActivated = !member.isSubscribed;
    const rowDisabled =
      (!isRelaxed && member.isChildBlocked) ||
      (!isRelaxed && notActivated) ||
      (config.isDiagnosticsFlow &&
        config.restrictToAhcSelection &&
        !member.ahcAvailable);
    const { text: subtitle, subClass } = selectPeopleMemberLine(member, {
      relaxMemberRestrictions: isRelaxed,
      showAhcSponsorSubtitle: config.showAhcSponsorSubtitle,
    });
    const rowClass = `hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}${rowDisabled && !canSubActivate ? " hc-person--disabled" : ""}${canSubActivate ? " hc-person--subscription-activate" : ""}${member.isChildBlocked && !isRelaxed ? " hc-person--age-blocked" : ""}`;
    const body = (
      <>
        <span className="hc-person__avatar" aria-hidden="true">
          <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
        </span>
        <span className="hc-person__info">
          <span className="hc-person__name">{member.name}</span>
          {subtitle ? (
            <span className={`hc-person__sub${subClass}`}>{subtitle}</span>
          ) : null}
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
    <section className="hc-block hc-block--flat-members">
      {displayMembers.map(renderMemberRow)}
      {!hideAddFamily && canAddFamily ? (
        <button type="button" className="hc-add-family" onClick={handleAddFamily}>
          <span className="hc-add-family__ic" aria-hidden="true">
            +
          </span>
          <span> Add new family member</span>
        </button>
      ) : null}
    </section>
  );
}
