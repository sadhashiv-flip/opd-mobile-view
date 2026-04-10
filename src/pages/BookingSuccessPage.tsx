import { useEffect, useMemo } from "react";
import { Link, matchPath, useLocation, useNavigate, useParams } from "react-router-dom";
import Lottie from "lottie-react";
import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import {
  DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
  DEFAULT_BOOKING_SUCCESS_TITLE,
  DEFAULT_CONSULT_SUCCESS_SUB_DENTAL,
  DEFAULT_CONSULT_SUCCESS_SUB_HOSPITAL,
  DEFAULT_CONSULT_SUCCESS_SUB_VIRTUAL,
  DEFAULT_CONSULT_SUCCESS_SUB_VISION,
  DEFAULT_CONSULT_SUCCESS_SUB_VISION_GLASSES_LENS,
  DEFAULT_CONSULT_SUCCESS_TITLE,
  isBookingSuccessLocationState,
} from "@/constants/bookingSuccessNavigation";
import successLottie from "@/assets/lotties/success.json";
import "./BookingSuccessPage.css";

const BOOKING_SUCCESS_REDIRECT_MS = 5000;

function isConsultSuccessPath(pathname: string): boolean {
  return (
    pathname === ROUTES.consultationHospitalBookingSuccess ||
    pathname === ROUTES.consultationVirtualBookingSuccess ||
    pathname === ROUTES.dentalBookingSuccess ||
    matchPath({ path: ROUTES.visionBookingSuccess, end: true }, pathname) != null
  );
}

function useConsultLayout(pathname: string, rawState: unknown): boolean {
  if (isConsultSuccessPath(pathname)) return true;
  if (pathname !== ROUTES.bookingSuccess) return false;
  const s = isBookingSuccessLocationState(rawState) ? rawState : undefined;
  return s?.layout === "consult";
}

function resolveConsultCopy(
  pathname: string,
  rawState: unknown,
  visionTypeParam: string | undefined,
): Readonly<{ title: string; sub: string }> {
  const s = isBookingSuccessLocationState(rawState) ? rawState : undefined;
  const title = s?.title?.trim() || DEFAULT_CONSULT_SUCCESS_TITLE;
  const desc = s?.description?.trim();
  if (desc) {
    return { title, sub: desc };
  }
  if (pathname === ROUTES.consultationVirtualBookingSuccess) {
    return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_VIRTUAL };
  }
  if (pathname === ROUTES.dentalBookingSuccess) {
    return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_DENTAL };
  }
  if (matchPath({ path: ROUTES.visionBookingSuccess, end: true }, pathname)) {
    const vt = visionTypeParam?.trim();
    if (vt === VISION_ROUTE_TYPE.glassesLens) {
      return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_VISION_GLASSES_LENS };
    }
    return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_VISION };
  }
  return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_HOSPITAL };
}

export function BookingSuccessPage() {
  const navigate = useNavigate();
  const { pathname, state: rawState } = useLocation();
  const { visionType: visionTypeParam } = useParams<{ visionType?: string }>();
  const consultLayout = useConsultLayout(pathname, rawState);
  const consultCopy = useMemo(
    () => resolveConsultCopy(pathname, rawState, visionTypeParam),
    [pathname, rawState, visionTypeParam],
  );

  const cardCopy = useMemo(() => {
    if (!isBookingSuccessLocationState(rawState)) {
      return {
        title: DEFAULT_BOOKING_SUCCESS_TITLE,
        description: DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
      };
    }
    const t = rawState.title?.trim();
    const d = rawState.description?.trim();
    return {
      title: t || DEFAULT_BOOKING_SUCCESS_TITLE,
      description: d || DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
    };
  }, [rawState]);

  useEffect(() => {
    if (consultLayout) return;
    const id = globalThis.setTimeout(() => {
      navigate(ROUTES.dashboard, { replace: true });
    }, BOOKING_SUCCESS_REDIRECT_MS);
    return () => globalThis.clearTimeout(id);
  }, [consultLayout, navigate]);

  if (consultLayout) {
    return (
      <div className="bs-page bs-page--consult">
        <div className="bs-consult-main">
          <h1 className="bs-consult-title">{consultCopy.title}</h1>
          <p className="bs-consult-sub">{consultCopy.sub}</p>
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
        <h1 className="bs-title">{cardCopy.title}</h1>
        <p className="bs-sub">{cardCopy.description}</p>

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
