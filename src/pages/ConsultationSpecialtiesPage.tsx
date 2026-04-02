import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useEffect, useState, type ReactNode } from "react";
import { fetchPatientIssues, type PatientIssue } from "@/api/issues";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import "./ConsultationSpecialtiesPage.css";

type Spec = Readonly<{ id: string; label: string; icon: string }>;

const SPECS: readonly Spec[] = [
  { id: "gp", label: "General Physician", icon: "🩺" },
  { id: "diet", label: "Dietician", icon: "🥗" },
  { id: "derm", label: "Dermatologist", icon: "🧴" },
  { id: "pulm", label: "Pulmonologist", icon: "🫁" },
  { id: "card", label: "cardiologist", icon: "🫀" },
  { id: "dent", label: "Dentist", icon: "🦷" },
] as const;

const VIRTUAL_SLOTS_STORAGE = "opd-mobile-view.virtualSlots.";

export function ConsultationSpecialtiesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "virtual";
  const isHospital = type === "at_hospital";
  const [selectedId, setSelectedId] = useState<string>("");
  const [virtualIssues, setVirtualIssues] = useState<readonly PatientIssue[]>([]);
  const [issuesLoad, setIssuesLoad] = useState<"loading" | "error" | "ok">(
    isHospital ? "ok" : "loading",
  );
  const [issuesError, setIssuesError] = useState<string | null>(null);

  useEffect(() => {
    if (isHospital) return;
    let cancelled = false;
    setIssuesLoad("loading");
    setIssuesError(null);
    fetchPatientIssues()
      .then((list) => {
        if (!cancelled) {
          setVirtualIssues(list);
          setIssuesLoad("ok");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setIssuesLoad("error");
          setIssuesError(e instanceof Error ? e.message : "Could not load specialties");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isHospital]);

  const topArea =
    isHospital ? null : (
      <div className="csp-search">
        <span className="csp-search__ic" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path
              d="M20 20l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          type="search"
          className="csp-search__input"
          placeholder="Search for doctors, symptoms, health concerns"
          aria-label="Search"
        />
      </div>
    );

  const hospitalSpecialtiesList = (
    <ul className="csp-list">
      {SPECS.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={`csp-item${selectedId === s.id ? " csp-item--selected" : ""}`}
            onClick={() => {
              setSelectedId(s.id);
              navigate(generatePath(ROUTES.consultationHospitalResults, { specialtyId: s.id }));
            }}
          >
            <div className="csp-item__ic" aria-hidden="true">
              {s.icon}
            </div>
            <div className="csp-item__label">{s.label}</div>
          </button>
        </li>
      ))}
    </ul>
  );

  let virtualSpecialtiesBody: ReactNode;
  if (issuesLoad === "loading") {
    virtualSpecialtiesBody = <div className="csp-issues-msg">Loading specialties…</div>;
  } else if (issuesLoad === "error") {
    virtualSpecialtiesBody = (
      <div className="csp-issues-msg csp-issues-msg--err" role="alert">
        {issuesError ?? "Could not load specialties"}
      </div>
    );
  } else if (virtualIssues.length === 0) {
    virtualSpecialtiesBody = (
      <div className="csp-issues-msg">No specialties available right now.</div>
    );
  } else {
    virtualSpecialtiesBody = (
      <ul className="csp-list" aria-label="Specialties">
        {virtualIssues.map((issue) => {
          const imgUrl = resolveProfileImageUrl(issue.image);
          const slotState = {
            parent: issue.parent,
            issueTitle: issue.title,
            /** `availableSlots?spid=` expects the issue’s `parent` (e.g. 1), not `id` (e.g. 132). */
            spid: issue.parent,
          };
          return (
            <li key={issue.id}>
              <button
                type="button"
                className="csp-item"
                onClick={() => {
                  sessionStorage.setItem(
                    `${VIRTUAL_SLOTS_STORAGE}${issue.id}`,
                    JSON.stringify(slotState),
                  );
                  navigate(
                    generatePath(ROUTES.consultationVirtualSlots, {
                      issueId: String(issue.id),
                    }),
                    { state: slotState },
                  );
                }}
              >
                <div className="csp-item__ic" aria-hidden="true">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      className="csp-item__thumb"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="csp-item__ic-fallback">—</span>
                  )}
                </div>
                <div className="csp-item__label">{issue.title}</div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="csp-page">
      <header className="csp-top">
        <Link
          to={generatePath(ROUTES.consultation, { type })}
          className="csp-back"
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
        </Link>
        <h1 className="csp-title">
          {isHospital ? "At Hospital Consultation" : "Doctor Consultation - Virtual"}
        </h1>
      </header>

      <div className="csp-loc">
        <span className="csp-loc__pin" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
              fill="#FF541E"
            />
            <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
          </svg>
        </span>
        <span className="csp-loc__title">Home</span>
        <span className="csp-loc__sep" aria-hidden="true">
          |
        </span>
        <span className="csp-loc__addr">Isprout, 7th floor, Plot No: 25, Divyasree trinity,</span>
        <span className="csp-loc__chev" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className={`csp-banner${isHospital ? " csp-banner--dark" : " csp-banner--green"}`}>
        <span className="csp-banner__text">
          {isHospital ? "Consult Top Doctors In-Clinic" : "Consult Top Doctors Online"}
        </span>
        <span className="csp-banner__art" aria-hidden="true" />
      </div>

      <main className="csp-main">
        {topArea}

        <div className="csp-section">
          <div className="csp-section__title">Common specialties</div>
          {isHospital ? hospitalSpecialtiesList : virtualSpecialtiesBody}
        </div>
      </main>
    </div>
  );
}
