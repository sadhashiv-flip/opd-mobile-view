import { ROUTES } from "@/constants";
import type { BookingSuccessLocationState, BookingSuccessSummaryRow } from "@/constants/bookingSuccessNavigation";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { useNavigate } from "react-router-dom";
import "./BookingSuccessWithSummary.css";

type BookingSuccessWithSummaryProps = Readonly<{
  state: BookingSuccessLocationState;
}>;

function SuccessHeaderIcon() {
  return (
    <div className="bss-icon" aria-hidden="true">
      <svg className="bss-icon__svg" viewBox="0 0 64 64" width="44" height="44" fill="none">
        <rect
          x="12"
          y="8"
          width="40"
          height="48"
          rx="4"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path
          d="M20 16h24M20 24h16M20 32h20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M40 40c0-4.4 3.6-8 8-8h.1M40 40c0 4.4-3.6 8-8 8H20M40 40H20"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M36 20h8v8h-8z"
          fill="currentColor"
          opacity="0.35"
        />
        <path d="M40 24v4M38 26h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SummaryRow({ row }: Readonly<{ row: BookingSuccessSummaryRow }>) {
  const multiline = row.value.includes("\n");
  return (
    <div className="bss-summary__row">
      <span className="bss-summary__label">{row.label}</span>
      <span className={`bss-summary__value${multiline ? " bss-summary__value--multiline" : ""}`}>
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
  const title = state.title?.trim() || "Booking successful";
  const description =
    state.description?.trim() ||
    "your request is successfully submitted,\nour executive will contact you shortly.";
  const cardTitle = state.summaryCardTitle?.trim() || "Appointment summary";
  const rows = state.summaryRows ?? [];

  const onViewOrder = () => {
    const override = state.viewOrderDetailPath?.trim();
    if (override) {
      void navigate(override, { replace: true });
      return;
    }
    const inv = state.orderDetailInvoiceId?.trim();
    if (!inv) {
      void navigate(ROUTES.orders, { replace: true });
      return;
    }
    const cat = state.orderDetailCategoryKey?.trim() || "lab";
    void navigate(pathToOrderDetail(cat, inv), { replace: true });
  };

  const onDone = () => {
    const target = state.doneNavigateTo?.trim() || ROUTES.dashboard;
    void navigate(target, { replace: true });
  };

  return (
    <div className="bss-page">
      <div className="bss-scroll">
        <SuccessHeaderIcon />
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
          <section className="bss-summary" aria-label={cardTitle}>
            <h2 className="bss-summary__heading">{cardTitle}</h2>
            <div className="bss-summary__divider" />
            <div className="bss-summary__rows">
              {rows.map((row, idx) => (
                <SummaryRow key={`bss-row-${String(idx)}`} row={row} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="bss-footer">
        <button type="button" className="bss-btn bss-btn--outline" onClick={onViewOrder}>
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
