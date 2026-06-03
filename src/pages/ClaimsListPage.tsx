import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import { fetchReimbursementsPage, type ReimbursementClaimSummary } from "@/api/patientReimbursement";
import { CLAIM_STATUS, CLAIM_STATUS_FILTERS, claimStatusBadge } from "@/constants/claimStatus";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import "./ClaimsPages.css";

function formatInr(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function formatClaimDate(iso: string | null): string {
  if (!iso?.trim()) return "—";
  const t = iso.trim();
  if (t.length >= 10 && t[4] === "-" && t[7] === "-") return t.slice(0, 10);
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return t.slice(0, 10);
}

function avatarInitial(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  const first = t[0];
  return first ? first.toUpperCase() : "?";
}


function DocumentBadgeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6l4 4v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12h10M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ClaimCard({
  row,
  onOpen,
}: Readonly<{ row: ReimbursementClaimSummary; onOpen: (row: ReimbursementClaimSummary) => void }>) {
  const badge = claimStatusBadge(row.statusCode, row.statusLabel);
  const displayName = row.patientName?.trim() || "Member";
  const initial = avatarInitial(row.patientName);

  return (
    <button type="button" className="claims-card claims-card--action" onClick={() => onOpen(row)}>
      <div className="claims-card__top">
        <div className="claims-card__avatar" aria-hidden>
          {initial}
        </div>
        <div className="claims-card__info">
          <h2 className="claims-card__name">{displayName}</h2>
          <p className="claims-card__id">#{row.id}</p>
        </div>
        <div className={`claims-card__badge claims-card__badge--${badge.variant}`}>
          <DocumentBadgeIcon />
          <span>{badge.text}</span>
        </div>
      </div>
      <div className="claims-card__divider" aria-hidden />
      <div className="claims-card__bottom">
        <div className="claims-card__col">
          <p className="claims-card__label">Date</p>
          <p className="claims-card__value">{formatClaimDate(row.createdAt)}</p>
        </div>
        <div className="claims-card__col claims-card__col--right">
          <p className="claims-card__label">Claimed</p>
          <p className="claims-card__value">{formatInr(row.claimAmount)}</p>
        </div>
      </div>
    </button>
  );
}

export function ClaimsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath =
    (location.state as { returnPath?: string } | null)?.returnPath?.trim() ||
    `${ROUTES.services}?tab=opd-claims`;

  const [items, setItems] = useState<readonly ReimbursementClaimSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const activeFilterChipRef = useRef<HTMLButtonElement | null>(null);

  const filtersVisible = !loading && !error && items.length > 0;

  useLayoutEffect(() => {
    if (!filtersVisible) return;
    const el = activeFilterChipRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, [filterIndex, filtersVisible]);

  const filteredItems = useMemo(() => {
    const f = CLAIM_STATUS_FILTERS[filterIndex];
    if (!f || f.status === CLAIM_STATUS.ALL) return items;
    const code = f.status;
    return items.filter((r) => r.statusCode === code);
  }, [items, filterIndex]);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchReimbursementsPage(nextPage);
      setHasMore(res.hasMore);
      setPage(res.page);
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load claims");
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(1, false);
  }, [load]);

  const onBack = useCallback(() => {
    navigate(returnPath);
  }, [navigate, returnPath]);

  const openClaim = useCallback(
    (row: ReimbursementClaimSummary) => {
      navigate(generatePath(ROUTES.claimsDetail, { claimId: row.id }), {
        state: { returnPath, summary: row },
      });
    },
    [navigate, returnPath],
  );

  return (
    <div className="claims-page">
      <header className="claims-screen-header">
        <button type="button" className="app-back-btn claims-screen-header__back" aria-label="Back" onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="claims-screen-header__title">My Claims</h1>
      </header>

      <main className="claims-page__main">
        {!loading && !error && items.length > 0 ? (
          <div className="claims-status-filters" role="tablist" aria-label="Filter by status">
            {CLAIM_STATUS_FILTERS.map((tab, idx) => (
              <button
                key={tab.label}
                ref={filterIndex === idx ? activeFilterChipRef : undefined}
                type="button"
                role="tab"
                aria-selected={filterIndex === idx}
                className={`claims-status-filters__chip${filterIndex === idx ? " claims-status-filters__chip--on" : ""}`}
                style={{ "--chip-accent": tab.color } as CSSProperties}
                onClick={() => setFilterIndex(idx)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? <p className="claims-row__meta">Loading…</p> : null}
        {!loading && error ? (
          <div className="claims-empty">
            <p>{error}</p>
            <button type="button" className="claim-footer__primary" onClick={() => void load(1, false)}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="claims-empty">
            <div className="claims-empty__icon" aria-hidden>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 6h12M8 10h12M8 14h8M4 6h1M4 10h1M4 14h1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path d="M6 18l-2-2v-8l2-2h2l2 2v8l-2 2H6z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
            <p>No claims found</p>
          </div>
        ) : null}

        {!loading && !error && filteredItems.length > 0 ? (
          <ul className="claims-list">
            {filteredItems.map((row) => (
              <li key={row.id}>
                <ClaimCard row={row} onOpen={openClaim} />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && items.length > 0 && filteredItems.length === 0 ? (
          <p className="claims-row__meta">No claims in this status.</p>
        ) : null}

        {!loading && !error && hasMore ? (
          <button
            type="button"
            className="claim-footer__back"
            style={{ width: "100%", marginTop: 12 }}
            disabled={loadingMore}
            onClick={() => void load(page + 1, true)}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </main>

      <button
        type="button"
        className="claims-fab"
        onClick={() => navigate(ROUTES.claimsNew, { state: { returnPath: ROUTES.claims } })}
      >
        <span className="claims-fab__icon" aria-hidden>
          +
        </span>
        New Claim
      </button>

      <HomeBottomNav />
    </div>
  );
}
