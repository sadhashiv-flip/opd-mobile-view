import { useCallback, useEffect, useState } from "react";
import { Link, generatePath, useLocation, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { ROUTES } from "@/constants";
import "./ProfileManagePage.css";

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5V20h3.5L17.5 10 14 6.5 4 16.5zM14 6.5l2-2 3.5 3.5-2 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function memberStatusBadgeClass(label: string | null): string {
  if (!label) return "";
  const t = label.trim().toLowerCase();
  if (t === "verified" || t === "active" || t === "approved") {
    return "profile-manage-page__member-badge profile-manage-page__member-badge--ok";
  }
  return "profile-manage-page__member-badge";
}

export function ProfileMembersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mod = useProfileModuleGates();
  const canAdd = mod.planDependents.dependentAddAllowed;
  const canEdit = mod.planDependents.dependentEditAllowed;
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

  useEffect(() => {
    void load();
  }, [load, location.key]);

  return (
    <div className="profile-manage-page">
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
        <h1 className="profile-manage-page__title">Members</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main">
        <p className="profile-manage-page__intro">
          {canEdit
            ? "View status for each member and tap edit to update their details."
            : "View status for each member on your plan."}
        </p>

        {canAdd ? (
          <Link to={ROUTES.profileMembersAdd} className="profile-manage-page__link-card">
            <span className="profile-manage-page__link-text">
              <span className="profile-manage-page__link-title">Add member</span>
              <span className="profile-manage-page__link-desc">
                Name, relationship, date of birth, gender, phone
              </span>
            </span>
            <span className="profile-manage-page__chevron" aria-hidden>
              ›
            </span>
          </Link>
        ) : null}

        {loading ? (
          <div className="profile-sub-skeleton" aria-busy="true">
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

        {!loading && !error && members.length > 0 ? (
          <section
            className="profile-manage-page__card profile-manage-page__member-list-wrap"
            aria-label="Members from account"
          >
            <h2 className="profile-manage-page__member-list-heading">Your members</h2>
            <ul className="profile-manage-page__member-list">
              {members.map((m) => (
                <li key={m.id} className="profile-manage-page__member-item">
                  <div className="profile-manage-page__member-row">
                    <div className="profile-manage-page__member-row-main">
                      <span className="profile-manage-page__member-name">{m.name}</span>
                      <span
                        className={
                          m.memberKind === "primary"
                            ? "profile-manage-page__member-role profile-manage-page__member-role--primary"
                            : "profile-manage-page__member-role"
                        }
                      >
                        {m.memberKind === "primary" ? "Primary" : "Dependent"}
                      </span>
                      {m.relationship || m.phone || m.dob ? (
                        <span className="profile-manage-page__member-meta">
                          {[m.relationship, m.phone, m.dob].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                      {m.statusLabel ? (
                        <span className={memberStatusBadgeClass(m.statusLabel)}>{m.statusLabel}</span>
                      ) : null}
                    </div>
                    
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!loading && !error && members.length === 0 ? (
          <p className="profile-manage-page__hint">
            {canAdd
              ? "No members yet. Tap Add member to create one."
              : "No members listed yet. Your plan may not allow adding members here."}
          </p>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
