import { useCallback, useEffect, useState } from "react";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import { fetchReimbursementsPage, type ReimbursementClaimSummary } from "@/api/patientReimbursement";
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

type BadgeVariant = "submitted" | "review" | "approved" | "rejected" | "muted";

function statusBadge(row: ReimbursementClaimSummary): { text: string; variant: BadgeVariant } {
  const c = row.statusCode;
  if (c === 0) return { text: "Submitted", variant: "submitted" };
  if (c === 1) return { text: "In review", variant: "review" };
  if (c === 2) return { text: "Approved", variant: "approved" };
  if (c === 3) return { text: "Rejected", variant: "rejected" };
  if (c != null) return { text: `Status ${c}`, variant: "muted" };
  return { text: "Submitted", variant: "submitted" };
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
  const badge = statusBadge(row);
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
        <button type="button" className="claims-screen-header__back" aria-label="Back" onClick={onBack}>
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

        {!loading && !error && items.length > 0 ? (
          <ul className="claims-list">
            {items.map((row) => (
              <li key={row.id}>
                <ClaimCard row={row} onOpen={openClaim} />
              </li>
            ))}
          </ul>
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
