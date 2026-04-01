import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useState } from "react";
import { SortSheet, type SortOptionId } from "@/components/sort/SortSheet";
import "@/components/sort/SortSheet.css";
import sortSvg from "@/assets/icons/common/Sort.svg";
import "./ConsultationSpecialtiesPage.css";

type Spec = Readonly<{ id: string; label: string; icon: string }>;
type Doctor = Readonly<{ id: string; name: string; degree: string; exp: string }>;

const SPECS: readonly Spec[] = [
  { id: "gp", label: "General Physician", icon: "🩺" },
  { id: "diet", label: "Dietician", icon: "🥗" },
  { id: "derm", label: "Dermatologist", icon: "🧴" },
  { id: "pulm", label: "Pulmonologist", icon: "🫁" },
  { id: "card", label: "cardiologist", icon: "🫀" },
  { id: "dent", label: "Dentist", icon: "🦷" },
] as const;

const VIRTUAL_DOCTORS_BY_SPEC: Readonly<Record<string, readonly Doctor[]>> = {
  gp: [
    { 
      id: "vd1", 
      name: "Dr. Prananka Reddy", degree: "MBBS, MD", exp: "10+ years exp" }, 
      { id: "vd2", name: "Dr. Pranavi Reddy", degree: "MBBS, MD", exp: "8+ years exp" }, 
      { id: "vd3", name: "Dr. Sadha shiv", degree: "MBBS, MD", exp: "5+ years exp" },
      { id: "vd4", name: "Dr. Manoj kumar", degree: "MBBS, MD", exp: "10+ years exp" },
      { id: "vd5", name: "Dr. Suresh kumar", degree: "MBBS, MD", exp: "6+ years exp" },
      { id: "vd6", name: "Dr. Ramesh kumar", degree: "MBBS, MD", exp: "5+ years exp" },
    ],
  diet: [],
  derm: [],
  pulm: [],
  card: [],
  dent: [],
} as const;

export function ConsultationSpecialtiesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "virtual";
  const isHospital = type === "at_hospital";
  const [selectedId, setSelectedId] = useState<string>("");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortId, setSortId] = useState<SortOptionId>("relevance");
  const virtualDoctors = selectedId ? VIRTUAL_DOCTORS_BY_SPEC[selectedId] ?? [] : [];
  const showVirtualSelected = !isHospital && selectedId.length > 0;
  const topArea = (() => {
    if (isHospital) return null;
    if (!showVirtualSelected) {
      return (
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
    }

    return (
      <div className="csp-vtop">
        <div className="csp-search-row">
          <div className="csp-search csp-search--with-actions">
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
          {virtualDoctors.length ? (
            <button
              type="button"
              className="csp-filter"
              aria-label="Sort and filters"
              onClick={() => setIsSortOpen(true)}
            >
              <img src={sortSvg} alt="" width={22} height={22} draggable={false} />
            </button>
          ) : null}
        </div>

        {virtualDoctors.length ? (
          <section className="csp-topdocs" aria-label="Top Doctors">
            <div className="csp-topdocs__title">Top Doctors</div>
            <div className="csp-slider" aria-label="Doctors slider">
              {virtualDoctors.map((d) => (
                <div key={d.id} className="csp-slide">
                  <div className="csp-doc">
                    <div className="csp-doc__avatar" aria-hidden="true" />
                    <div className="csp-doc__meta">
                      <div className="csp-doc__name">{d.name}</div>
                      <div className="csp-doc__deg">{d.degree}</div>
                    </div>
                  </div>
                  <div className="csp-doc__tag">{d.exp}</div>
                  <button type="button" className="csp-book">
                    Book Appointment
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="csp-empty">No doctors available for this speciality.</div>
        )}
      </div>
    );
  })();

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
          <ul className="csp-list">
            {SPECS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`csp-item${selectedId === s.id ? " csp-item--selected" : ""}`}
                  onClick={() => {
                    setSelectedId(s.id);
                    if (isHospital) {
                      navigate(
                        generatePath(ROUTES.consultationHospitalResults, { specialtyId: s.id }),
                      );
                    }
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
        </div>
      </main>

      <SortSheet
        open={isSortOpen}
        value={sortId}
        onChange={setSortId}
        onClose={() => setIsSortOpen(false)}
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M7 12h10M10 18h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="8" cy="6" r="2" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
            <circle cx="14" cy="12" r="2" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="18" r="2" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          </svg>
        }
      />
    </div>
  );
}

