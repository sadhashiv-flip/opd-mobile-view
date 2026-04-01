import { ROUTES } from "@/constants";
import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import "./AddFamilyMemberPage.css";

const FAMILY_STORAGE_KEY = "opd-mobile-view.health-checkups.family";

export function AddFamilyMemberPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isConsultation = location.pathname.toLowerCase().startsWith("/consultation/");
  const parentTitle = (() => {
    if (isConsultation) return "Consultation";
    if (type === "lab-tests") return "Lab Tests";
    return "Health Checkups";
  })();

  const [relationship, setRelationship] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  const save = () => {
    const next = {
      id: `family-${Date.now()}`,
      name: name.trim(),
      subtitle: "Packages available",
      relationship: relationship.trim(),
      dob: dob.trim(),
      gender: gender.trim(),
      phone: phone.trim(),
    };
    try {
      const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
      const existing = raw ? (JSON.parse(raw) as unknown) : [];
      const list = Array.isArray(existing) ? existing : [];
      localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify([...list, next]));
    } catch {
      // ignore storage errors
    }
    navigate(
      isConsultation
        ? generatePath(ROUTES.consultation, { type })
        : generatePath(ROUTES.diagnosticsType, { type }),
    );
  };

  return (
    <div className="afm-page">
      <header className="afm-top">
        <Link
          to={
            isConsultation
              ? generatePath(ROUTES.consultation, { type })
              : generatePath(ROUTES.diagnosticsType, { type })
          }
          className="afm-back"
          aria-label={`Back to ${parentTitle}`}
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
        <h1 className="afm-title">Add new family member</h1>
      </header>

      <main className="afm-main">
        <form
          className="afm-form"
          aria-label="Add family member form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            save();
          }}
        >
          <label className="afm-input">
            <span className="visually-hidden">Relationship</span>
            <select
              className="afm-input__control afm-select"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              required
            >
              <option value="" disabled>
                Relationship
              </option>
              <option value="Self">Self</option>
              <option value="Spouse">Spouse</option>
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Son">Son</option>
              <option value="Daughter">Daughter</option>
              <option value="Sibling">Sibling</option>
              <option value="Other">Other</option>
            </select>
            <span className="afm-chevron" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Name</span>
            <input
              className="afm-input__control"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Date of birth</span>
            <input
              type="date"
              className="afm-input__control"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Gender</span>
            <select
              className="afm-input__control afm-select"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
            >
              <option value="" disabled>
                Gender
              </option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <span className="afm-chevron" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Phone number</span>
            <input
              className="afm-input__control"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <p className="afm-note">
            Lorem ipsum is simply dummy text of the printing and typesetting lorem ipsum is
            simply dummy text of the printing and typesetting
          </p>
        </form>
      </main>

      <footer className="afm-footer">
        <button type="button" className="afm-save" onClick={save} disabled={!canSave}>
          Save and continue
        </button>
      </footer>
    </div>
  );
}

