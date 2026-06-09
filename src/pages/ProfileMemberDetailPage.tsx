import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  fetchPatientMemberById,
  type MemberDisplay,
} from "@/api/patientMember";
import { ROUTES } from "@/constants";
import { FamilyMemberAvatar } from "@/components/family/FamilyMemberAvatar";
import {
  buildFamilyMemberAgeGenderLine,
  dashIfEmpty,
  formatFamilyRelationshipLabel,
} from "@/lib/familyMemberDisplay";
import "./ProfileManagePage.css";

type DetailLocationState = Readonly<{
  member?: MemberDisplay;
  returnPath?: string;
}>;

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function CakeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10h16v10H4V10zM8 10V7a2 2 0 114 0v3M12 10V6a2 2 0 114 0v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16v12H4V6zm0 0l8 7 8-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ContactTile({
  icon,
  label,
  value,
  muted,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: string;
  muted: boolean;
}>) {
  return (
    <div className="family-member-detail__contact">
      <div className="family-member-detail__contact-icon" aria-hidden>
        {icon}
      </div>
      <div className="family-member-detail__contact-text">
        <span className="family-member-detail__contact-label">{label}</span>
        <span
          className={
            muted
              ? "family-member-detail__contact-value family-member-detail__contact-value--muted"
              : "family-member-detail__contact-value"
          }
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export function ProfileMemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const locState = location.state as DetailLocationState | null | undefined;

  const [member, setMember] = useState<MemberDisplay | null>(
    locState?.member?.id === memberId ? locState.member : null,
  );
  const [loading, setLoading] = useState(!member);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = memberId?.trim();
    if (!id) {
      setError("Member not found.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const found = await fetchPatientMemberById(id);
      if (!found) {
        setError("Unable to load this member.");
        setMember(null);
      } else {
        setMember(found);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this member.");
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (member?.id === memberId) return;
    void load();
  }, [load, member?.id, memberId]);

  const backPath = locState?.returnPath ?? ROUTES.profileMembers;

  const displayName = useMemo(() => {
    const n = member?.name?.trim();
    return n?.length ? n : "Member";
  }, [member?.name]);

  const otherDetailRows = useMemo(() => {
    if (!member) return [];
    const rows: { label: string; value: string }[] = [
      {
        label: "Relationship",
        value: formatFamilyRelationshipLabel(member.relationship, "—"),
      },
    ];
    const bg = member.bloodGroup?.trim();
    if (bg) rows.push({ label: "Blood group", value: bg });
    const emp = member.empId?.trim();
    if (emp) rows.push({ label: "Employee ID", value: emp });
    return rows;
  }, [member]);

  return (
    <div className="profile-manage-page family-member-detail">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={() => navigate(backPath)}
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
        <h1 className="profile-manage-page__title">Member details</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main family-member-detail__main">
        {loading ? (
          <div className="profile-sub-skeleton" aria-busy="true">
            <div className="profile-sub-skeleton__card" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="profile-manage-page__card profile-sub-error">
            <p className="profile-sub-error__text">{error}</p>
            <button
              type="button"
              className="profile-manage-page__save"
              onClick={() => void load()}
            >
              Try again
            </button>
            <p className="profile-manage-page__hint">
              <Link to={ROUTES.profileMembers}>Back to family accounts</Link>
            </p>
          </div>
        ) : null}

        {!loading && !error && member ? (
          <>
            <section className="family-member-detail__hero" aria-label="Member profile">
              <div className="family-member-detail__hero-head">
                <FamilyMemberAvatar
                  name={displayName}
                  image={member.image}
                  variant="detail"
                />
                <div className="family-member-detail__hero-text">
                  <h2 className="family-member-detail__name">{displayName}</h2>
                  <p className="family-member-detail__age-gender">
                    {buildFamilyMemberAgeGenderLine(member)}
                  </p>
                </div>
              </div>
              <div className="family-member-detail__hero-divider" aria-hidden />
              <ContactTile
                icon={<CakeIcon />}
                label="Date of birth"
                value={dashIfEmpty(member.dob)}
                muted={!member.dob?.trim()}
              />
              <div className="family-member-detail__hero-divider family-member-detail__hero-divider--light" aria-hidden />
              <ContactTile
                icon={<PhoneIcon />}
                label="Phone number"
                value={dashIfEmpty(member.phone)}
                muted={!member.phone?.trim()}
              />
              <div className="family-member-detail__hero-divider family-member-detail__hero-divider--light" aria-hidden />
              <ContactTile
                icon={<MailIcon />}
                label="Email"
                value={dashIfEmpty(member.email)}
                muted={!member.email?.trim()}
              />
            </section>

            <h3 className="family-member-detail__section-label">Other details</h3>
            <section className="family-member-detail__other-card" aria-label="Other member details">
              {otherDetailRows.map((row, index) => (
                <div key={row.label}>
                  {index > 0 ? (
                    <div className="family-member-detail__other-divider" aria-hidden />
                  ) : null}
                  <div className="family-member-detail__other-row">
                    <span className="family-member-detail__other-label">{row.label}</span>
                    <span className="family-member-detail__other-value">{row.value}</span>
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
