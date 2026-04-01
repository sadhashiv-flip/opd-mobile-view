import { ROUTES } from "@/constants";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";

type PersonCard = Readonly<{
  id: string;
  name: string;
  subtitle: string;
  section: "self" | "family";
  trailing?: "selected" | "add";
}>;

const FAMILY_STORAGE_KEY = "opd-mobile-view.health-checkups.family";
const GYM_SELECTED_PERSON_KEY = "opd-mobile-view.gym-membership.selectedPersonId";

function readStoredGymPlanId(): string | null {
  try {
    const p = localStorage.getItem("opd-mobile-view.gym-membership.planId");
    return p && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

const SEED_MEMBERS: readonly PersonCard[] = [
  {
    id: "self-1",
    name: "Gundari Abhinay",
    subtitle: "sponsored by your company",
    section: "self",
    trailing: "selected",
  },
  {
    id: "family-1",
    name: "Gundari Abhinay",
    subtitle: "Packages available",
    section: "family",
    trailing: "add",
  },
] as const;

export function GymMembershipSelectPeoplePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const statePlanId =
    typeof (location.state as { planId?: unknown } | null)?.planId === "string"
      ? (location.state as { planId: string }).planId
      : null;
  const planId = statePlanId ?? readStoredGymPlanId();

  const pageTitle = "Gym Membership";

  const [familyMembers, setFamilyMembers] = useState<PersonCard[]>([]);
  const [selectedId, setSelectedId] = useState<string>(SEED_MEMBERS[0].id);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .filter(
          (m): m is { id: unknown; name: unknown; subtitle: unknown } =>
            !!m &&
            typeof m === "object" &&
            "id" in m &&
            "name" in m &&
            "subtitle" in m,
        )
        .filter(
          (m): m is { id: string; name: string; subtitle: string } =>
            typeof m.id === "string" &&
            typeof m.name === "string" &&
            typeof m.subtitle === "string",
        )
        .map((m) => ({
          id: m.id,
          name: m.name,
          subtitle: m.subtitle,
          section: "family" as const,
        }));
      setFamilyMembers(cleaned);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!planId) {
      navigate(ROUTES.gymMembership, { replace: true });
    }
  }, [planId, navigate]);

  const members = useMemo<PersonCard[]>(
    () => [...SEED_MEMBERS, ...familyMembers],
    [familyMembers],
  );

  const selfMembers = useMemo(
    () => members.filter((m) => m.section === "self"),
    [members],
  );

  const familyMembersList = useMemo(
    () => members.filter((m) => m.section === "family"),
    [members],
  );

  const renderTrailing = (member: PersonCard) => {
    const isSelected = selectedId === member.id;

    if (isSelected) {
      return (
        <span className="hc-person__cta hc-person__cta--added" aria-hidden="true">
          <img
            src={selectSvg}
            alt=""
            width={18}
            height={18}
            draggable={false}
          />
        </span>
      );
    }

    return (
      <button
        type="button"
        className="hc-person__cta"
        aria-label="Add"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(member.id);
        }}
      >
        Add
      </button>
    );
  };

  if (!planId) {
    return null;
  }

  return (
    <div className="hc-page">
      <header className="hco-top">
        <Link to={ROUTES.gymMembership} className="hco-back" aria-label="Back to gym plans">
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
        <h1 className="hco-title">{pageTitle}</h1>
        <Link to={ROUTES.orders} className="hco-orders">
          <span className="hco-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          My Orders
        </Link>
      </header>

      <main className="hc-main">
        <section className="hc-block">
          <h2 className="hc-block__title">For you</h2>
          <p className="hc-block__hint">
            <span className="hc-check" aria-hidden="true">
              ✓
            </span>
            Book free health checkups
          </p>

          {selfMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              className={`hc-person${selectedId === member.id ? " hc-person--selected" : ""}`}
              onClick={() => setSelectedId(member.id)}
            >
              <span className="hc-person__avatar" aria-hidden="true">
                <img
                  src={profileSvg}
                  alt=""
                  width={22}
                  height={22}
                  draggable={false}
                />
              </span>
              <span className="hc-person__info">
                <span className="hc-person__name">{member.name}</span>
                <span className="hc-person__sub">{member.subtitle}</span>
              </span>
              {renderTrailing(member)}
            </button>
          ))}
        </section>

        <section className="hc-block">
          <h2 className="hc-block__title">For your family</h2>
          <p className="hc-block__hint">
            <span className="hc-check" aria-hidden="true">
              ✓
            </span>
            Book polik health checkups for family members
          </p>

          {familyMembersList.map((member) => (
            <button
              key={member.id}
              type="button"
              className={`hc-person${selectedId === member.id ? " hc-person--selected" : ""}`}
              onClick={() => setSelectedId(member.id)}
            >
              <span className="hc-person__avatar" aria-hidden="true">
                <img
                  src={profileSvg}
                  alt=""
                  width={22}
                  height={22}
                  draggable={false}
                />
              </span>
              <span className="hc-person__info">
                <span className="hc-person__name">{member.name}</span>
                <span
                  className={`hc-person__sub${member.subtitle === "Packages available" ? " hc-person__sub--muted" : ""}`}
                >
                  {member.subtitle}
                </span>
              </span>
              {renderTrailing(member)}
            </button>
          ))}

          <button
            type="button"
            className="hc-add-family"
            onClick={() =>
              navigate(ROUTES.addFamilyMember, {
                state: {
                  title: pageTitle,
                  returnPath: ROUTES.gymMembershipSelectPeople,
                  returnState: { planId },
                },
              })
            }
          >
            <span className="hc-add-family__ic" aria-hidden="true">
              +
            </span>
            Add new family member
          </button>
        </section>
      </main>

      <footer className="hc-footer">
        <button
          type="button"
          className="hc-continue"
          onClick={() => {
            try {
              localStorage.setItem(GYM_SELECTED_PERSON_KEY, selectedId);
            } catch {
              // ignore storage errors
            }
            navigate(ROUTES.gymMembershipConfigure, {
              state: planId ? { planId } : undefined,
            });
          }}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
