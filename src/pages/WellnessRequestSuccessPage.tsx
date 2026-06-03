import { ROUTES } from "@/constants";
import { WELLNESS_SUCCESS_BODY, WELLNESS_SUCCESS_TITLE } from "@/constants/wellnessCopy";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import "./WellnessFlow.css";

export type WellnessSuccessLocationState = Readonly<{
  nutrition?: boolean;
  service?: string;
  memberName?: string;
  language?: string;
  invoiceId?: string;
  orderId?: string;
  message?: string;
}>;

function SummaryRow({ label, value, last }: Readonly<{ label: string; value: string; last?: boolean }>) {
  return (
    <div className={`wellness-success-row${last ? " wellness-success-row--last" : ""}`}>
      <span className="wellness-success-row__label">{label}</span>
      <span className="wellness-success-row__value">{value}</span>
    </div>
  );
}

export function WellnessRequestSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as WellnessSuccessLocationState | null) ?? {};

  const isNutrition = state.nutrition === true;
  const service = (state.service ?? "").trim();
  const memberName = (state.memberName ?? "").trim();
  const language = (state.language ?? "").trim();
  const invoiceId = (state.invoiceId ?? "").trim();
  const orderId = (state.orderId ?? "").trim();
  const serverMessage = (state.message ?? "").trim();

  const subtitle =
    serverMessage ||
    (isNutrition ? WELLNESS_SUCCESS_BODY.nutrition : WELLNESS_SUCCESS_BODY.mental);

  const rows: Array<{ label: string; value: string }> = [];
  if (orderId) rows.push({ label: "Order ID", value: `#${orderId}` });
  if (invoiceId) rows.push({ label: "Invoice ID", value: `#${invoiceId}` });
  if (memberName) rows.push({ label: "Request for", value: memberName });
  if (service) rows.push({ label: "Service", value: service });
  if (language) rows.push({ label: "Language", value: language });

  if (!service && !invoiceId && !orderId && !memberName) {
    return <Navigate to={ROUTES.services} replace />;
  }

  const orderDetailPath = invoiceId
    ? pathToOrderDetail(isNutrition ? "nutrition" : "mental_wellness", invoiceId)
    : null;

  return (
    <div className="wellness-flow-page wellness-flow-page--success">
      <main className="wellness-flow-page__main wellness-flow-page__main--centered">
        <div className="wellness-success-icon" aria-hidden>
          {isNutrition ? "🥗" : "🧠"}
        </div>
        <h1 className="wellness-success-title">{WELLNESS_SUCCESS_TITLE}</h1>
        <p className="wellness-success-sub">{subtitle}</p>

        {rows.length > 0 ? (
          <section className="wellness-success-card" aria-label="Request summary">
            <h2 className="wellness-success-card__title">Request summary</h2>
            <hr className="wellness-success-card__divider" />
            {rows.map((r, i) => (
              <SummaryRow key={r.label} label={r.label} value={r.value} last={i === rows.length - 1} />
            ))}
          </section>
        ) : null}
      </main>

      <footer className="wellness-flow-page__footer wellness-flow-page__footer--stack">
        {orderDetailPath ? (
          <button
            type="button"
            className="wellness-flow-page__cta wellness-flow-page__cta--outline"
            onClick={() =>
              void navigate(orderDetailPath, {
                state: { fromBookingSuccess: true },
              })
            }
          >
            View order details
          </button>
        ) : null}
        <Link to={ROUTES.dashboard} className="wellness-flow-page__cta">
          Done
        </Link>
      </footer>
    </div>
  );
}
