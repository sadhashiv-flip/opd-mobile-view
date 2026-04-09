import {
  fetchWalletTransactionsPage,
  type WalletRefTypeApi,
  type WalletStatusFilter,
  type WalletTransactionRow,
} from "@/api/wallet";
import { WalletFilterBottomSheet } from "@/components/wallet/WalletFilterBottomSheet";
import { WalletScreenHeader } from "@/components/wallet/WalletScreenHeader";
import { WalletTransactionItem } from "@/components/wallet/WalletTransactionItem";
import { ROUTES } from "@/constants";
import { useCallback, useEffect, useState } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import "./WalletPages.css";

function FilterSlidersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h5M15 7h5M4 12h3M17 12h3M4 17h7M15 17h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="11.5" cy="7" r="2.25" fill="#ffffff" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="12" r="2.25" fill="#ffffff" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13.5" cy="17" r="2.25" fill="#ffffff" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function WalletAllTransactionsPage() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const navigate = useNavigate();
  const subId = subscriptionId?.trim() ?? "";

  const [items, setItems] = useState<readonly WalletTransactionRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WalletStatusFilter | null>(null);
  const [refTypeFilter, setRefTypeFilter] = useState<WalletRefTypeApi | null>(null);

  const handleBack = useCallback(() => {
    navigate(generatePath(ROUTES.walletSubscription, { subscriptionId: subId }));
  }, [navigate, subId]);

  const loadFirst = useCallback(async () => {
    if (!subId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWalletTransactionsPage(subId, {
        page: 1,
        limit: 20,
        status: statusFilter,
        refType: refTypeFilter,
      });
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
    } catch (e) {
      setItems([]);
      setHasMore(false);
      setError(e instanceof Error ? e.message : "Could not load transactions");
    } finally {
      setLoading(false);
    }
  }, [subId, statusFilter, refTypeFilter]);

  useEffect(() => {
    if (!subId) {
      navigate(ROUTES.wallet, { replace: true });
      return;
    }
    void loadFirst();
  }, [subId, loadFirst, navigate]);

  const onLoadMore = async () => {
    if (!subId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const res = await fetchWalletTransactionsPage(subId, {
        page: nextPage,
        limit: 20,
        status: statusFilter,
        refType: refTypeFilter,
      });
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const onApplyFilters = useCallback(
    (next: { status: WalletStatusFilter | null; refType: WalletRefTypeApi | null }) => {
      setStatusFilter(next.status);
      setRefTypeFilter(next.refType);
    },
    [],
  );

  return (
    <div className="wallet-tx-page">
      <WalletScreenHeader
        title="All Transactions"
        onBack={handleBack}
        right={
          <button
            type="button"
            className="wallet-screen-header__filter"
            aria-label="Filter transactions"
            onClick={() => setFilterOpen(true)}
          >
            <FilterSlidersIcon />
          </button>
        }
      />

      <main className="wallet-tx-page__main">
        {loading ? (
          <div className="wallet-skeleton" aria-busy="true">
            <div className="wallet-skeleton__row" />
            <div className="wallet-skeleton__row" />
            <div className="wallet-skeleton__row" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="wallet-state wallet-state--error">
            <p>{error}</p>
            <button type="button" className="wallet-retry" onClick={() => void loadFirst()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="wallet-state">No transactions found.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="wallet-tx-list">
            {items.map((row) => (
              <li key={row.id}>
                <WalletTransactionItem row={row} />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && hasMore ? (
          <div className="wallet-tx-page__load-more">
            <button
              type="button"
              className="wallet-tx-page__load-more-btn"
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </main>

      <WalletFilterBottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={onApplyFilters}
        initialStatus={statusFilter}
        initialRefType={refTypeFilter}
      />
    </div>
  );
}
