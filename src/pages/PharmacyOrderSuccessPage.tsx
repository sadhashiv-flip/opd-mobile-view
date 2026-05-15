import { ROUTES } from "@/constants";
import { ORDER_DETAIL_FROM_BOOKING_SUCCESS, pathToOrderDetail } from "@/lib/orderDetailRoutes";
import {
  pharmacyKindUi,
  pharmacySuccessSubtitle,
  pharmacySuccessSummaryRows,
  type PharmacyOrderKindNav,
  type PharmacyOrderSuccessLocationState,
} from "@/lib/pharmacyOrderRequestSuccess";
import { Link, useLocation } from "react-router-dom";
import "./PharmacyPages.css";

const DISCLAIMER =
  "Medicine delivery timelines vary depending on factors like location, type of medication, order timing, and quantity ordered.";

function KindIcon({ kind }: Readonly<{ kind: PharmacyOrderKindNav }>) {
  if (kind === "OTC") {
    return (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 11V7a3 3 0 016 0v4M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "UPLOAD") {
    return (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 16V4m0 0l4 4m-4-4L8 8M6 20h12"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v4m6 2v6a6 6 0 01-12 0V10m12 0a6 6 0 10-12 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M10 14h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function PharmacyOrderSuccessPage() {
  const location = useLocation();
  const st = location.state as PharmacyOrderSuccessLocationState | Partial<PharmacyOrderSuccessLocationState> | null;

  const orderKind: PharmacyOrderKindNav =
    st?.orderKind === "OTC" || st?.orderKind === "UPLOAD" || st?.orderKind === "FLIPHEALTH"
      ? st.orderKind
      : "UPLOAD";

  const ui = pharmacyKindUi(orderKind);
  const message = typeof st?.message === "string" ? st.message : "";
  const subtitle = pharmacySuccessSubtitle(message);
  const orderId = (st?.orderId ?? "").toString().trim();
  const invoiceId = (st?.invoiceId ?? "").toString().trim();
  const patientName = (st?.patientName ?? "").toString().trim();
  const addressLine = (st?.addressLine ?? "").toString().trim();
  const itemCount = typeof st?.itemCount === "number" ? st.itemCount : undefined;

  const rows = pharmacySuccessSummaryRows({
    kind: orderKind,
    orderId,
    patientName,
    addressLine,
    itemCount,
  });

  const hasInvoice = invoiceId.length > 0;
  const viewOrderHref = hasInvoice
    ? pathToOrderDetail("pharmacy", invoiceId)
    : ROUTES.orders;
  const viewOrderLabel = hasInvoice ? "View order details" : "View my orders";

  return (
    <div className="ph-page ph-page--req-success">
      <main className="ph-req-success">
        <div className="ph-req-success__body">
          <div className="ph-req-success__icon-wrap" aria-hidden>
            <div className="ph-req-success__icon-bg">
              <span className="ph-req-success__icon">
                <KindIcon kind={orderKind} />
              </span>
            </div>
            <span className="ph-req-success__badge" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          <h1 className="ph-req-success__title">{ui.title}</h1>
          <p className="ph-req-success__sub">{subtitle}</p>

          {rows.length > 0 ? (
            <section className="ph-req-summary" aria-labelledby="ph-req-summary-h">
              <h2 id="ph-req-summary-h" className="ph-req-summary__heading">
                {ui.summaryHeading}
              </h2>
              <div className="ph-req-summary__divider" />
              <ul className="ph-req-summary__list">
                {rows.map((r) => (
                  <li key={`${r.label}:${r.value}`} className="ph-req-summary__row">
                    <span className="ph-req-summary__label">{r.label}</span>
                    <span
                      className={`ph-req-summary__value${r.smallValue ? " ph-req-summary__value--addr" : ""}`}
                    >
                      {r.value}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="ph-req-note" role="note">
            <span className="ph-req-note__ic" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v5M12 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="ph-req-note__text">{DISCLAIMER}</p>
          </div>
        </div>
      </main>

      <div className="ph-footer-dual">
        <Link
          to={viewOrderHref}
          state={hasInvoice ? ORDER_DETAIL_FROM_BOOKING_SUCCESS : undefined}
          className="ph-footer-dual__outline"
        >
          {viewOrderLabel}
        </Link>
        <Link to={ROUTES.dashboard} className="ph-footer-dual__solid">
          Done
        </Link>
      </div>
    </div>
  );
}
