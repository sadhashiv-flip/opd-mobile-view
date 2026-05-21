import { ROUTES } from "@/constants";
import type { BookingSuccessLocationState, BookingSuccessSummaryRow } from "@/constants/bookingSuccessNavigation";
import {
  VIRTUAL_CONSULT_BOOKING_SUCCESS_CARD_TITLE,
  VIRTUAL_CONSULT_BOOKING_SUCCESS_SUB,
  VIRTUAL_CONSULT_BOOKING_SUCCESS_TITLE,
} from "@/constants/bookingSuccessNavigation";
import { navigateToOrderDetailFromBookingSuccess, pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { useNavigate } from "react-router-dom";
import "./BookingSuccessWithSummary.css";

type BookingSuccessWithSummaryProps = Readonly<{
  state: BookingSuccessLocationState;
}>;

function MedicalSuccessIcon() {
  return (
    <div className="bss-icon bss-icon--medical" aria-hidden="true">
      <svg className="bss-icon__svg" viewBox="0 0 24 24" width="56" height="56" fill="none">
        <rect x="5" y="8" width="14" height="12" rx="2" fill="currentColor" />
        <path
          d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M12 11v5M9.5 13.5h5" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SummaryRow({
  row,
  virtualConsult,
}: Readonly<{ row: BookingSuccessSummaryRow; virtualConsult: boolean }>) {
  const multiline = row.value.includes("\n");
  return (
    <div className={`bss-summary__row${virtualConsult ? " bss-summary__row--vc" : ""}`}>
      <span className="bss-summary__label">{row.label}</span>
      <span
        className={`bss-summary__value${multiline ? " bss-summary__value--multiline" : ""}${row.label === "Location" ? " bss-summary__value--small" : ""}`}
      >
        {multiline
          ? row.value.split("\n").map((line, i) => (
              <span key={`${row.label}-${String(i)}`} className="bss-summary__value-line">
                {line}
              </span>
            ))
          : row.value}
      </span>
    </div>
  );
}

/**
 * Full-screen booking success with optional appointment summary — use for any service when
 * `location.state.summaryRows` is populated (paid or unpaid booking).
 */
export function BookingSuccessWithSummary({ state }: BookingSuccessWithSummaryProps) {
  const navigate = useNavigate();
  const virtualConsult = state.successUiVariant === "virtual-consult";
  const title =
    state.title?.trim() ||
    (virtualConsult ? VIRTUAL_CONSULT_BOOKING_SUCCESS_TITLE : "Booking successful");
  const description =
    state.description?.trim() ||
    (virtualConsult
      ? VIRTUAL_CONSULT_BOOKING_SUCCESS_SUB
      : "your request is successfully submitted,\nour executive will contact you shortly.");
  const cardTitle =
    state.summaryCardTitle?.trim() ||
    (virtualConsult ? VIRTUAL_CONSULT_BOOKING_SUCCESS_CARD_TITLE : "Appointment summary");
  const rows = state.summaryRows ?? [];
  const apptRef = state.appointmentReferenceId?.trim();

  const onViewOrder = () => {
    const override = state.viewOrderDetailPath?.trim();
    if (override) {
      navigateToOrderDetailFromBookingSuccess(navigate, override);
      return;
    }
    const inv = state.orderDetailInvoiceId?.trim();
    if (!inv) {
      void navigate(ROUTES.orders, { replace: true });
      return;
    }
    const cat = state.orderDetailCategoryKey?.trim() || "lab";
    navigateToOrderDetailFromBookingSuccess(navigate, pathToOrderDetail(cat, inv));
  };

  const onDone = () => {
    const target = state.doneNavigateTo?.trim() || ROUTES.dashboard;
    void navigate(target, { replace: true });
  };

  return (
    <div className={`bss-page${virtualConsult ? " bss-page--virtual-consult" : ""}`}>
      <div className="bss-scroll">
        {virtualConsult ? <MedicalSuccessIcon /> : <LegacySuccessIcon />}
        <h1 className="bss-title">{title}</h1>
        <p className="bss-sub">
          {description.split("\n").map((line, i) => (
            <span key={`d-${String(i)}`}>
              {i > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </p>

        {rows.length > 0 ? (
          <section
            className={`bss-summary${virtualConsult ? " bss-summary--vc" : ""}`}
            aria-label={cardTitle}
          >
            <h2 className="bss-summary__heading">{cardTitle}</h2>
            <div className="bss-summary__divider" />
            {apptRef ? (
              <p className="bss-summary__ref">#{apptRef.replace(/^#/, "")}</p>
            ) : null}
            <div className="bss-summary__rows">
              {rows.map((row, idx) => (
                <SummaryRow
                  key={`bss-row-${String(idx)}`}
                  row={row}
                  virtualConsult={virtualConsult}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className={`bss-footer${virtualConsult ? " bss-footer--vc" : ""}`}>
        <button
          type="button"
          className={`bss-btn bss-btn--outline${virtualConsult ? " bss-btn--outline-vc" : ""}`}
          onClick={onViewOrder}
        >
          View order details
        </button>
        <button type="button" className="bss-btn bss-btn--primary" onClick={onDone}>
          <span>Done</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 12l4 4 8-8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </footer>
    </div>
  );
}

function LegacySuccessIcon() {
  return (
    <div className="bss-icon" aria-hidden="true">
      <svg className="bss-icon__svg" viewBox="0 0 64 64" width="44" height="44" fill="none">
        <rect x="12" y="8" width="40" height="48" rx="4" stroke="currentColor" strokeWidth="2.2" />
        <path
          d="M20 16h24M20 24h16M20 32h20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
