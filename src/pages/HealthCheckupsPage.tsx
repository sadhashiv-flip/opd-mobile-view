import { ROUTES } from "@/constants";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import { HC_PERSON_ADD_CTA_TOOLTIP } from "@/lib/gymMemberDisplay";
import { Link, generatePath, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import "./HealthCheckupsPage.css";

type PersonCard = Readonly<{
  id: string;
  name: string;
  subtitle: string;
  section: "self" | "family";
  trailing?: "selected" | "add";
}>;

const FAMILY_STORAGE_KEY = "opd-mobile-view.health-checkups.family";

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

export function HealthCheckupsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mod = useProfileModuleGates();
  const canAddFamily = mod.planDependents.dependentAddAllowed;
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isConsultation = location.pathname.toLowerCase().startsWith("/consultation/");
  const pageTitle = (() => {
    if (isConsultation) return "Consultation";
    if (type === "lab-tests") return "Lab Tests";
    return "Health Checkups";
  })();
  const consultationKind = isConsultation ? (type === "at_hospital" ? "at_hospital" : "virtual") : null;
  const consultationLabel =
    consultationKind === "at_hospital" ? "At Hospital" : consultationKind === "virtual" ? "Virtual" : "";
  const forYouHint = isConsultation
    ? consultationKind === "at_hospital"
      ? "Book your OPD consultations at hospital"
      : "Connecting care, virtually everywhere"
    : "Book free health checkups";
  const forFamilyHint = isConsultation
    ? consultationKind === "at_hospital"
      ? "Book paid OPD consultations for family members"
      : "Add family members for virtual consultations"
    : "Book polik health checkups for family members";

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
      if (cleaned.length > 0 && selectedId === "self-1") {
        // Keep default selection unless we want to auto-select family.
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedId]);

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
      <span className="hc-person__cta" aria-hidden="true" title={HC_PERSON_ADD_CTA_TOOLTIP}>
        Add
      </span>
    );
  };

  return (
    <div className="hc-page">
      <header className="hc-top">
        <Link to={ROUTES.dashboard} className="hc-back" aria-label="Back to home">
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
        <h1 className="hc-title">{pageTitle}</h1>
        {isConsultation ? <span className="hc-mode">{consultationLabel}</span> : null}
      </header>

      <main className="hc-main">
        <section className="hc-block">
          <h2 className="hc-block__title">For you</h2>
          <p className="hc-block__hint">
            <span className="hc-check" aria-hidden="true">
              ✓
            </span>
            {forYouHint}
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
            {forFamilyHint}
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

          {canAddFamily ? (
            <button
              type="button"
              className="hc-add-family"
              onClick={() =>
                navigate(ROUTES.profileMembersAdd, {
                  state: { returnPath: `${location.pathname}${location.search}` },
                })
              }
            >
              <span className="hc-add-family__ic" aria-hidden="true">
                +
              </span>{" "}
              Add new family member
            </button>
          ) : null}
        </section>
      </main>

      <footer className="hc-footer">
        <button
          type="button"
          className="bottom-continue"
          onClick={() => {
            try {
              localStorage.setItem("opd-mobile-view.health-checkups.selectedPersonId", selectedId);
            } catch {
              // ignore storage errors
            }
            if (isConsultation) {
              navigate(generatePath(ROUTES.consultationSpecialties, { type }));
              return;
            }
            navigate(generatePath(ROUTES.diagnosticsPlan, { type }));
          }}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}

