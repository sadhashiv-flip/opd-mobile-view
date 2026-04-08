import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { ROUTES } from "@/constants";
import successLottie from "@/assets/lotties/success.json";
import "./BookingSuccessPage.css";

const BOOKING_SUCCESS_REDIRECT_MS = 5000;

export function BookingSuccessPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isConsultationHospitalSuccess = pathname === ROUTES.consultationHospitalBookingSuccess;

  useEffect(() => {
    if (isConsultationHospitalSuccess) return;
    const id = globalThis.setTimeout(() => {
      navigate(ROUTES.dashboard, { replace: true });
    }, BOOKING_SUCCESS_REDIRECT_MS);
    return () => globalThis.clearTimeout(id);
  }, [navigate, isConsultationHospitalSuccess]);

  if (isConsultationHospitalSuccess) {
    return (
      <div className="bs-page bs-page--consult">
        <div className="bs-consult-main">
          <h1 className="bs-consult-title">Appointment Booked!</h1>
          <p className="bs-consult-sub">Appointment booked successfully.</p>
          <div className="bs-lottie-wrap" aria-hidden="true">
            <Lottie animationData={successLottie} loop className="bs-lottie" />
          </div>
        </div>
        <footer className="bs-consult-footer">
          <button
            type="button"
            className="bs-alright"
            onClick={() => navigate(ROUTES.dashboard, { replace: true })}
          >
            Alright
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="bs-page">
      <div className="bs-card">
        <div className="bs-badge" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="bs-title">Appointment booking successfully.</h1>
        <p className="bs-sub">
          Your booking has been confirmed. You can track it in My Orders.
        </p>

        <div className="bs-actions">
          <Link className="bs-btn bs-btn--primary" to={ROUTES.orders}>
            My Orders
          </Link>
          <Link className="bs-btn bs-btn--ghost" to={ROUTES.dashboard}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
