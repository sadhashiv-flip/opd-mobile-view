import { useEffect, useMemo } from "react";
import { Link, matchPath, useLocation, useNavigate, useParams } from "react-router-dom";
import Lottie from "lottie-react";
import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import {
  DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
  DEFAULT_BOOKING_SUCCESS_TITLE,
  DEFAULT_CONSULT_SUCCESS_SUB_HOSPITAL,
  DEFAULT_CONSULT_SUCCESS_SUB_VIRTUAL,
  DEFAULT_CONSULT_SUCCESS_SUB_GENERIC_BOOKING,
  DEFAULT_CONSULT_SUCCESS_TITLE,
  VIRTUAL_CONSULT_BOOKING_SUCCESS_SUB,
  VIRTUAL_CONSULT_BOOKING_SUCCESS_TITLE,
  buildDefaultServiceBookingSuccessState,
  isBookingSuccessLocationState,
  mergeGenericBookingSuccessState,
  resolveDiagnosticsBookingSuccessCardCopy,
  type ServiceBookingKind,
} from "@/constants/bookingSuccessNavigation";
import { BookingSuccessWithSummary } from "@/components/booking/BookingSuccessWithSummary";
import successLottie from "@/assets/lotties/success.json";
import "./BookingSuccessPage.css";

const BOOKING_SUCCESS_REDIRECT_MS = 5000;

function isConsultSuccessPath(pathname: string): boolean {
  return (
    pathname === ROUTES.consultationHospitalBookingSuccess ||
    pathname === ROUTES.consultationVirtualBookingSuccess
  );
}

function serviceKindFromSuccessPath(
  pathname: string,
): ServiceBookingKind | null {
  if (pathname === ROUTES.dentalBookingSuccess) return "dental";
  if (matchPath({ path: ROUTES.visionBookingSuccess, end: true }, pathname) != null) {
    return "vision";
  }
  return null;
}

function visionBookingTypeLabel(visionTypeParam: string | undefined): string {
  const vt = visionTypeParam?.trim();
  if (vt === VISION_ROUTE_TYPE.glassesLens) return "Glasses / lens";
  return "Eye checkup";
}

/** Lottie + Alright — dedicated consult/dental/vision success URLs only (not `/services/booking-success`). */
function useConsultLayout(pathname: string): boolean {
  return isConsultSuccessPath(pathname);
}

/** Appointment summary card (paid or unpaid) — when `location.state` carries summary rows. */
function useSummaryLayout(rawState: unknown): boolean {
  const s = isBookingSuccessLocationState(rawState) ? rawState : undefined;
  if (!s) return false;
  if ((s.summaryRows?.length ?? 0) > 0) return true;
  return s.layout === "summary";
}

function resolveConsultCopy(
  pathname: string,
  rawState: unknown,
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
  if (pathname === ROUTES.bookingSuccess) {
    return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_GENERIC_BOOKING };
  }
  return { title, sub: DEFAULT_CONSULT_SUCCESS_SUB_HOSPITAL };
}

export function BookingSuccessPage() {
  const navigate = useNavigate();
  const { pathname, state: rawState } = useLocation();
  const { visionType: visionTypeParam, type: diagnosticsTypeParam } = useParams<{
    visionType?: string;
    type?: string;
  }>();
  const consultLayout = useConsultLayout(pathname);
  const summaryLayout = useSummaryLayout(rawState);

  const consultCopy = useMemo(
    () => resolveConsultCopy(pathname, rawState),
    [pathname, rawState],
  );

  const cardCopy = useMemo(() => {
    const onDiagnosticsSuccess =
      matchPath({ path: ROUTES.diagnosticsBookingSuccess, end: true }, pathname) != null;
    if (onDiagnosticsSuccess) {
      return resolveDiagnosticsBookingSuccessCardCopy(diagnosticsTypeParam);
    }
    const s = isBookingSuccessLocationState(rawState) ? rawState : undefined;
    if (s?.successUiVariant === "virtual-consult") {
      return {
        title: s.title?.trim() || VIRTUAL_CONSULT_BOOKING_SUCCESS_TITLE,
        description: s.description?.trim() || VIRTUAL_CONSULT_BOOKING_SUCCESS_SUB,
      };
    }
    if (!s) {
      return {
        title: DEFAULT_BOOKING_SUCCESS_TITLE,
        description: DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
      };
    }
    const t = s.title?.trim();
    const d = s.description?.trim();
    return {
      title: t || DEFAULT_BOOKING_SUCCESS_TITLE,
      description: d || DEFAULT_BOOKING_SUCCESS_DESCRIPTION,
    };
  }, [diagnosticsTypeParam, pathname, rawState]);

  /** Summary UI: generic success, dental/vision URLs, diagnostics when state includes rows. */
  const summaryScreenState = useMemo(() => {
    if (pathname === ROUTES.bookingSuccess) {
      return mergeGenericBookingSuccessState(rawState, cardCopy);
    }
    const serviceKind = serviceKindFromSuccessPath(pathname);
    if (serviceKind) {
      if (summaryLayout && isBookingSuccessLocationState(rawState)) {
        return rawState;
      }
      return buildDefaultServiceBookingSuccessState(
        serviceKind,
        serviceKind === "vision" ? visionBookingTypeLabel(visionTypeParam) : "Dental care",
      );
    }
    if (summaryLayout && isBookingSuccessLocationState(rawState)) {
      return rawState;
    }
    return null;
  }, [pathname, rawState, cardCopy, summaryLayout, visionTypeParam]);

  useEffect(() => {
    if (consultLayout || summaryScreenState != null) return;
    const id = globalThis.setTimeout(() => {
      navigate(ROUTES.orders, { replace: true });
    }, BOOKING_SUCCESS_REDIRECT_MS);
    return () => globalThis.clearTimeout(id);
  }, [consultLayout, summaryScreenState, navigate]);

  if (summaryScreenState != null) {
    return <BookingSuccessWithSummary state={summaryScreenState} />;
  }

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
            onClick={() => navigate(ROUTES.orders, { replace: true })}
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
