import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useMemo } from "react";
import "./ConsultationAppointmentOverviewPage.css";

export function ConsultationAppointmentOverviewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const doctorId = typeof params.doctorId === "string" ? params.doctorId : "d1";

  const doctorName = useMemo(() => {
    if (doctorId === "d1") return "Dr. Strange";
    return "Doctor";
  }, [doctorId]);

  const slotLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.slotLabel") ?? "";
    } catch {
      return "";
    }
  }, []);

  const dateLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.dateLabel") ?? "";
    } catch {
      return "";
    }
  }, []);

  return (
    <div className="cao-page">
      <header className="cao-top">
        <Link
          to={generatePath(ROUTES.consultationHospitalSlots, { specialtyId, doctorId })}
          className="cao-back"
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
        <h1 className="cao-title">Book Appointment</h1>
      </header>

      <main className="cao-main">
        <section className="cao-doc">
          <div className="cao-doc__top">
            <div className="cao-doc__avatar" aria-hidden="true" />
            <div className="cao-doc__meta">
              <div className="cao-doc__name">{doctorName}</div>
              <div className="cao-doc__sub">MBBS, MD</div>
            </div>
            <div className="cao-chip">Cashless Available</div>
          </div>
          <div className="cao-tags">
            <span className="cao-tag">10+ years exp</span>
            <span className="cao-tag cao-tag--pill">Yashoda Hospital</span>
          </div>
        </section>

        <section className="cao-fees">
          <div className="cao-fees__row">
            <span>Doctor&apos;s Fee</span>
            <strong>₹ 600</strong>
          </div>
          <div className="cao-fees__row cao-fees__row--total">
            <span>Total Amount</span>
            <strong>₹ 600</strong>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Patient</div>
          <div className="cao-field__row">
            <div className="cao-field__value">Kalyan</div>
            <button type="button" className="cao-edit" aria-label="Edit patient">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                  stroke="#1A73E8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Date and time</div>
          <div className="cao-field__row">
            <div className="cao-field__value">
              {dateLabel || "September 15, 2025"} | {slotLabel || "2PM–3PM"}
            </div>
            <button type="button" className="cao-edit" aria-label="Edit date and time">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                  stroke="#1A73E8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section className="cao-disc">
          <div className="cao-disc__title">Disclaimer</div>
          <ol className="cao-disc__list">
            <li>
              The Fees and Timings are tentative and may subject to change at the time of consultation
            </li>
            <li>
              Registration fee charged by Clinic or Hospital are not covered under OPD insurance and has to be borne by the insured
            </li>
          </ol>
        </section>
      </main>

      <footer className="cao-footer">
        <button
          type="button"
          className="cao-confirm"
          onClick={() => navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type: "health-checkups" }))}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}

