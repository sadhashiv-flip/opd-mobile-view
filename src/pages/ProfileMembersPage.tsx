import { useCallback, useEffect, useState } from "react";
import { Link, generatePath, useLocation, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { ROUTES } from "@/constants";
import { FamilyMemberAvatar } from "@/components/family/FamilyMemberAvatar";
import {
  buildFamilyMemberListSubtitle,
  memberShowsFamilyActivateCta,
} from "@/lib/familyMemberDisplay";
import { MEMBER_SUBSCRIPTION_ACTIVATE_LABEL } from "@/lib/gymMemberDisplay";
import "./ProfileManagePage.css";

function PersonAddIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 8a3 3 0 11-6 0 3 3 0 016 0zM4 20v-1a4 4 0 014-4h4a4 4 0 014 4v1M19 8v6M16 11h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIconSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.6 10.8a15.9 15.9 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FamilyMemberTile({
  member,
  onOpen,
}: Readonly<{
  member: MemberDisplay;
  onOpen: (member: MemberDisplay) => void;
}>) {
  const name = member.name.trim() || "Member";
  const subtitle = buildFamilyMemberListSubtitle(member);
  const phone = member.phone?.trim() ?? "";
  const canActivate = memberShowsFamilyActivateCta(member);

  return (
    <article className="family-accounts__tile">
      <button
        type="button"
        className="family-accounts__tile-main"
        onClick={() => onOpen(member)}
      >
        <FamilyMemberAvatar name={name} image={member.image} variant="list" />
        <div className="family-accounts__tile-body">
          <span className="family-accounts__tile-name">{name}</span>
          {subtitle ? (
            <span className="family-accounts__tile-subtitle">{subtitle}</span>
          ) : null}
          {phone ? (
            <span className="family-accounts__tile-phone">
              <PhoneIconSmall />
              <span>{phone}</span>
            </span>
          ) : null}
        </div>
      </button>
      {canActivate ? (
        <Link
          to={ROUTES.profileSubscriptions}
          className="family-accounts__activate"
          onClick={(e) => e.stopPropagation()}
        >
          {MEMBER_SUBSCRIPTION_ACTIVATE_LABEL}
        </Link>
      ) : (
        <span className="family-accounts__chevron" aria-hidden>
          ›
        </span>
      )}
    </article>
  );
}

export function ProfileMembersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mod = useProfileModuleGates();
  const canAdd = mod.planDependents.dependentAddAllowed;
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchAllPatientMembers();
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load members");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath);
    } else {
      navigate(ROUTES.profile);
    }
  }, [location.state, navigate]);

  const openMember = useCallback(
    (member: MemberDisplay) => {
      navigate(generatePath(ROUTES.profileMembersDetail, { memberId: member.id }), {
        state: { member, returnPath: ROUTES.profileMembers },
      });
    },
    [navigate],
  );

  useEffect(() => {
    void load();
  }, [load, location.key]);

  return (
    <div className="profile-manage-page family-accounts">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="app-back-btn profile-manage-page__back"
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
        </button>
        <h1 className="profile-manage-page__title">Family Accounts</h1>
        {canAdd ? (
          <Link
            to={ROUTES.profileMembersAdd}
            state={{ fromAccountManagement: true }}
            className="family-accounts__add-btn"
            aria-label="Add new family member"
          >
            <PersonAddIcon />
          </Link>
        ) : (
          <span className="profile-manage-page__spacer" aria-hidden />
        )}
      </header>

      <main className="profile-manage-page__main family-accounts__main">
        {loading ? (
          <div className="profile-sub-skeleton" aria-busy="true">
            <div className="profile-sub-skeleton__card" />
            <div className="profile-sub-skeleton__card" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="profile-manage-page__card profile-sub-error">
            <p className="profile-sub-error__text">{error}</p>
            <button type="button" className="profile-manage-page__save" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && members.length === 0 ? (
          <div className="family-accounts__empty">
            <div className="family-accounts__empty-icon" aria-hidden>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="family-accounts__empty-title">No family members yet</p>
            <p className="family-accounts__empty-desc">
              {canAdd
                ? "Tap + to add someone to your account."
                : "Your plan may not allow adding members here."}
            </p>
          </div>
        ) : null}

        {!loading && !error && members.length > 0 ? (
          <ul className="family-accounts__list">
            {members.map((m) => (
              <li key={m.id}>
                <FamilyMemberTile member={m} onOpen={openMember} />
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
