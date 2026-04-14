import { useCallback, useEffect, useState } from "react";
import {
  fetchInvoicesPage,
  INVOICE_FILTER_TYPES,
  type InvoiceFilterId,
  type InvoiceOrderRow,
} from "@/api/patientInvoices";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { ROUTES } from "@/constants";
import { generatePath, Link, useNavigate } from "react-router-dom";
import "./OrdersPage.css";

const FILTER_TABS: readonly { id: InvoiceFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "consultation", label: "Consultation" },
  { id: "labTest", label: "Lab Test" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "dental", label: "Dental" },
  { id: "vision", label: "Vision" },
  { id: "vaccine", label: "Vaccine" },
  { id: "gym", label: "Gym" },
  { id: "mentalWellness", label: "Mental Wellness" },
  { id: "nutrition", label: "Nutrition" },
] as const;

function ChevronRight() {
  return (
    <svg className="orders-card__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OrderCard({ row }: Readonly<{ row: InvoiceOrderRow }>) {
  return (
    <article className="orders-card">
      <div className="orders-card__icon-wrap" aria-hidden>
        <OrderCategoryIcon categoryKey={row.categoryKey} className="orders-card__icon-img" />
      </div>
      <div className="orders-card__mid">
        <h2 className="orders-card__title">{row.categoryLabel}</h2>
        {row.orderIdLine.trim().length > 0 ? (
          <div className="orders-card__id-row">
            <p className="orders-card__order-id">{row.orderIdLine}</p>
            {/* {row.consultationPlaceTag ? (
              <span
                className={`orders-card__place-tag orders-card__place-tag--${row.consultationPlaceTag}`}
              >
                {row.consultationPlaceTag === "virtual" ? "Virtual" : "In-person"}
              </span>
            ) : null} */}
          </div>
        ) : null}
        <p className="orders-card__meta">{row.metaLine}</p>
      </div>
      <div className="orders-card__right">
        <span className={`orders-card__badge orders-card__badge--${row.statusTone}`}>
          {row.statusLabel}
        </span>
        <div className="orders-card__right-bottom">
          <span
            className={row.isFree ? "orders-card__price orders-card__price--free" : "orders-card__price"}
          >
            {row.isFree ? "FREE" : row.amountFormatted ?? "—"}
          </span>
          <ChevronRight />
        </div>
      </div>
    </article>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InvoiceFilterId>("all");
  const [items, setItems] = useState<readonly InvoiceOrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async (fid: InvoiceFilterId) => {
    setLoading(true);
    setError(null);
    try {
      const type = INVOICE_FILTER_TYPES[fid];
      const res = await fetchInvoicesPage({
        type: type ?? undefined,
        page: 1,
        limit: 20,
      });
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
    } catch (e) {
      setItems([]);
      setHasMore(false);
      setError(e instanceof Error ? e.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirst(filter);
  }, [filter, loadFirst]);

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const type = INVOICE_FILTER_TYPES[filter];
      const res = await fetchInvoicesPage({
        type: type ?? undefined,
        page: nextPage,
        limit: 20,
      });
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more orders");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="orders-page">
      <main className="orders-page__main">
        <h1 className="orders-page__title">My Orders</h1>

        <div className="orders-filters" role="tablist" aria-label="Order type">
          <div className="orders-filters__scroll">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`orders-filter-pill${active ? " orders-filter-pill--active" : ""}`}
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="orders-skeleton" aria-busy="true">
            {[0, 1, 2].map((k) => (
              <div key={k} className="orders-skeleton__card" />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="orders-state orders-state--error">
            <p>{error}</p>
            <button type="button" className="orders-retry" onClick={() => void loadFirst(filter)}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="orders-state orders-state--empty">No orders yet.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="orders-list">
            {items.map((row) => (
              <li key={row.id} className="orders-list__item">
                <div className="orders-list__row">
                  <Link
                    to={generatePath(ROUTES.ordersDetail, { invoiceId: row.id })}
                    className="orders-card-link"
                  >
                    <OrderCard row={row} />
                  </Link>
                  {row.canJoinOnlineConsultation && row.videoAppointmentId ? (
                    <button
                      type="button"
                      className="orders-join-call"
                      onClick={() => {
                        const appointmentId = row.videoAppointmentId;
                        if (!appointmentId) return;
                        navigate(generatePath(ROUTES.videoCall, { appointmentId }));
                      }}
                    >
                      Join call
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && hasMore ? (
          <div className="orders-more-wrap">
            <button
              type="button"
              className="orders-more"
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
