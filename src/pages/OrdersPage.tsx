import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  fetchInvoicesPage,
  INVOICE_FILTER_TYPES,
  type InvoiceFilterId,
  type InvoiceOrderRow,
} from "@/api/patientInvoices";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { MobileFilterChip, MobileFilterSheet } from "@/components/mobileFilter/MobileFilterSheet";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { ROUTES } from "@/constants";
import familyAccountsSvg from "@/assets/icons/patient-app/hub/account_management/family_account.svg";
import profileSvg from "@/assets/icons/patient-app/hub/account_management/profile.svg";
import {
  invoiceOrderRowsFromDashboardOngoing,
  type OrdersPageLocationState,
} from "@/lib/dashboardOngoingToInvoiceRow";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { generatePath, Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "./OrdersPage.css";

const ORDERS_TAB_STORAGE_KEY = "opd-mobile-view.orders.filterTab";
const ORDERS_USER_FILTER_KEY = "opd-mobile-view.orders.userFilter";

function parseInvoiceFilterTab(raw: string | null): InvoiceFilterId | null {
  if (!raw) return null;
  return raw in INVOICE_FILTER_TYPES ? (raw as InvoiceFilterId) : null;
}

function readStoredUserFilter(): string {
  try {
    return sessionStorage.getItem(ORDERS_USER_FILTER_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Maps invoice filter tab → {@link OrderCategoryIcon} key (Flutter `OrdersController.iconForType`). */
function invoiceTabToCategoryKey(tab: InvoiceFilterId): string {
  switch (tab) {
    case "all":
      return "orders_all";
    case "labTest":
      return "lab";
    case "mentalWellness":
      return "mental_wellness";
    default:
      return tab;
  }
}

const FILTER_TABS: readonly { id: InvoiceFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "consultation", label: "Consultation" },
  { id: "labTest", label: "Lab Test" },
  { id: "subscriptions", label: "Subscriptions" },
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
          </div>
        ) : null}
        <p className="orders-card__meta">{row.metaLine}</p>
      </div>
      <div className="orders-card__right">
        <span className={`orders-card__badge orders-card__badge--${row.statusTone}`}>
          {row.statusLabel}
        </span>
        <div className="orders-card__right-bottom">
          {row.amountFormatted ? (
            <span className="orders-card__price">{row.amountFormatted}</span>
          ) : null}
          <ChevronRight />
        </div>
      </div>
    </article>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabSynced, setTabSynced] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** When set, list shows dashboard GET `/patient/dashboard` ongoing rows only (no `GET /invoice` list). */
  const [dashboardRows, setDashboardRows] = useState<InvoiceOrderRow[] | null>(null);
  const [items, setItems] = useState<readonly InvoiceOrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<readonly MemberDisplay[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [userFilterId, setUserFilterId] = useState(readStoredUserFilter);

  const rawTabParam = searchParams.get("tab");
  const tabFromUrl = parseInvoiceFilterTab(rawTabParam);
  const filter: InvoiceFilterId = tabFromUrl ?? "all";

  const dashboardPayload = (location.state as OrdersPageLocationState | null)?.dashboardOngoing;

  const navigatedWithDashboardOngoing =
    Array.isArray(dashboardPayload) && dashboardPayload.length > 0;
  /** True while showing the dashboard ongoing list (route state and/or hydrated rows). Category filters only — no invoice list API. */
  const isOngoingFromDashboard = navigatedWithDashboardOngoing || dashboardRows != null;

  const displayRows = useMemo(() => {
    if (dashboardRows != null) return [...dashboardRows];
    return [...items];
  }, [dashboardRows, items]);

  const filterActiveDot = isOngoingFromDashboard
    ? filter !== "all"
    : filter !== "all" || userFilterId.trim().length > 0;

  useLayoutEffect(() => {
    const raw = searchParams.get("tab");
    if (raw) {
      const v = parseInvoiceFilterTab(raw);
      if (v == null) {
        setSearchParams({}, { replace: true });
      } else {
        try {
          sessionStorage.setItem(ORDERS_TAB_STORAGE_KEY, v);
        } catch {
          /* ignore */
        }
      }
      setTabSynced(true);
      return;
    }
    let stored: InvoiceFilterId | null = null;
    try {
      stored = parseInvoiceFilterTab(sessionStorage.getItem(ORDERS_TAB_STORAGE_KEY));
    } catch {
      /* ignore */
    }
    if (stored != null && stored !== "all") {
      setSearchParams({ tab: stored }, { replace: true });
    }
    setTabSynced(true);
  }, [searchParams, setSearchParams]);

  const setFilterTab = useCallback(
    (id: InvoiceFilterId) => {
      try {
        sessionStorage.setItem(ORDERS_TAB_STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
      if (id === "all") {
        setSearchParams({}, { replace: false });
      } else {
        setSearchParams({ tab: id }, { replace: false });
      }
    },
    [setSearchParams],
  );

  /** Full My Orders only — ongoing-from-dashboard uses in-memory rows + category filters; no list or member APIs. */
  useEffect(() => {
    if (navigatedWithDashboardOngoing) {
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
      try {
        const m = await fetchAllPatientMembers();
        if (!cancelled) setMembers(m);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigatedWithDashboardOngoing]);

  const loadFirst = useCallback(
    async (fid: InvoiceFilterId) => {
      setLoading(true);
      setError(null);
      try {
        const type = INVOICE_FILTER_TYPES[fid];
        const uid = userFilterId.trim();
        const res = await fetchInvoicesPage({
          type: type ?? undefined,
          page: 1,
          limit: 20,
          userId: uid.length > 0 ? uid : null,
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
    },
    [userFilterId],
  );

  /** Hydrate from dashboard “View all” once — category changes only re-filter via {@link displayRows} (no GET /invoice). */
  useEffect(() => {
    if (!tabSynced) return;
    if (Array.isArray(dashboardPayload) && dashboardPayload.length > 0) {
      setDashboardRows(invoiceOrderRowsFromDashboardOngoing(dashboardPayload));
      setItems([]);
      setHasMore(false);
      setPage(1);
      setLoading(false);
      setError(null);
      return;
    }
    setDashboardRows(null);
  }, [dashboardPayload, tabSynced]);

  /** Full My Orders: refetch when tab or member filter changes. Skipped entirely while showing dashboard ongoing only. */
  useEffect(() => {
    if (!tabSynced) return;
    if (Array.isArray(dashboardPayload) && dashboardPayload.length > 0) return;
    void loadFirst(filter);
  }, [dashboardPayload, filter, loadFirst, tabSynced]);

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    if (isOngoingFromDashboard) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const type = INVOICE_FILTER_TYPES[filter];
      const uid = userFilterId.trim();
      const res = await fetchInvoicesPage({
        type: type ?? undefined,
        page: nextPage,
        limit: 20,
        userId: uid.length > 0 ? uid : null,
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

  const persistUserFilter = (id: string) => {
    const v = id.trim();
    setUserFilterId(v);
    try {
      sessionStorage.setItem(ORDERS_USER_FILTER_KEY, v);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const uid = userFilterId.trim();
    if (!uid) return;
    const m = members.find((x) => x.id === uid);
    if (m && !m.isSubscribed) {
      setUserFilterId("");
      try {
        sessionStorage.setItem(ORDERS_USER_FILTER_KEY, "");
      } catch {
        /* ignore */
      }
    }
  }, [members, userFilterId]);

  let emptyPrimaryMessage = "No orders found for this category.";
  if (dashboardRows != null && displayRows.length === 0) {
    emptyPrimaryMessage = "No ongoing orders.";
  } else if (filter === "all" && userFilterId.trim().length === 0) {
    emptyPrimaryMessage = "No orders yet.";
  }

  return (
    <div className="orders-page">
      <main className="orders-page__main">
        <div className="orders-page__title-row">
          <h1 className="orders-page__title">
            {isOngoingFromDashboard ? "My ongoing orders" : "My Orders"}
          </h1>
          {isOngoingFromDashboard ? null : (
            <button
              type="button"
              className="orders-filter-appbar-btn"
              aria-label="Filter orders"
              title="Filter orders"
              onClick={() => setSheetOpen(true)}
            >
              <span className="orders-filter-appbar-btn__icon-wrap">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 6h4.5M10 6h10M14 18h6M4 18h7M9 12h11M4 12h3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="9" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="7" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
                </svg>
                {filterActiveDot ? <span className="orders-filter-appbar-btn__dot" aria-hidden /> : null}
              </span>
            </button>
          )}
        </div>

        {isOngoingFromDashboard ? null : (
          <MobileFilterSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Filter orders"
            subtitle="Choose a category and optionally a family member"
          >
            <div className="mobile-filter-sheet__divider" />
            <div className="mobile-filter-sheet__section">
              <div className="mobile-filter-sheet__wrap">
                {FILTER_TABS.map((tab) => (
                  <MobileFilterChip
                    key={tab.id}
                    label={tab.label}
                    icon={
                      <OrderCategoryIcon categoryKey={invoiceTabToCategoryKey(tab.id)} width={18} height={18} />
                    }
                    selected={filter === tab.id}
                    onClick={() => {
                      setFilterTab(tab.id);
                      setSheetOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mobile-filter-sheet__divider" />
            <div className="mobile-filter-sheet__section-label">Family member</div>
            <div className="mobile-filter-sheet__section">
              {membersLoading ? (
                <div className="mobile-filter-sheet__members-loading mobile-filter-sheet__members-loading--text">
                  Loading…
                </div>
              ) : (
                <div className="mobile-filter-sheet__wrap">
                  <MobileFilterChip
                    label="All members"
                    icon={<img src={familyAccountsSvg} alt="" width={18} height={18} />}
                    selected={userFilterId.trim().length === 0}
                    onClick={() => {
                      persistUserFilter("");
                      setSheetOpen(false);
                    }}
                  />
                  {members.map((m) => (
                    <MobileFilterChip
                      key={m.id}
                      label={m.name.trim().length > 0 ? m.name : m.id}
                      icon={<img src={profileSvg} alt="" width={18} height={18} />}
                      selected={userFilterId === m.id}
                      disabled={!m.isSubscribed}
                      onClick={() => {
                        persistUserFilter(m.id);
                        setSheetOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </MobileFilterSheet>
        )}

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
            <button
              type="button"
              className="orders-retry"
              onClick={() => {
                if (dashboardRows != null) return;
                void loadFirst(filter);
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && displayRows.length === 0 ? (
          <p className="orders-state orders-state--empty">{emptyPrimaryMessage}</p>
        ) : null}

        {!loading && !error && displayRows.length > 0 ? (
          <ul className="orders-list">
            {displayRows.map((row) => (
              <li key={row.id} className="orders-list__item">
                <div className="orders-list__row">
                  <Link to={pathToOrderDetail(row.categoryKey, row.id)} className="orders-card-link">
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

        {!loading && !error && dashboardRows == null && hasMore ? (
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
