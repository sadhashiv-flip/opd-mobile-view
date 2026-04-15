import { ROUTES } from "@/constants";
import {
  clearLabCart,
  fetchLabCart,
  removeLabCartItem,
  type LabCartItem,
  type LabCartPricing,
} from "@/api/patientLabCart";
import { Link, generatePath, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./CartOverviewPage.css";
import { HeaderTexts } from "@/constants/HeaderTexts";
import { useToast } from "@/hooks/useToast";

function formatInr(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function CartOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<readonly LabCartItem[]>([]);
  const [pricing, setPricing] = useState<LabCartPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchLabCart();
      setItems(snap.items);
      setPricing(snap.pricing);
    } catch (e) {
      setItems([]);
      setPricing(null);
      toast.error(e instanceof Error ? e.message : "Could not load cart");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const countPhrase = useMemo(() => {
    const n = items.length;
    return `${n} ${n === 1 ? "test" : "tests"} in cart`;
  }, [items.length]);

  const walletBalance = pricing?.walletAvailable ?? pricing?.walletTotal ?? null;
  const walletCovered = pricing != null && !pricing.isPaymentRequired;

  const onRemove = async (cartItemId: number) => {
    if (removingId != null) return;
    setRemovingId(cartItemId);
    try {
      await removeLabCartItem(cartItemId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove item");
    } finally {
      setRemovingId(null);
    }
  };

  const onClearAll = async () => {
    if (items.length === 0 || clearing) return;
    setClearing(true);
    try {
      await clearLabCart();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear cart");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="co-page co-page--v2">
      <header className="co-top co-top--v2">
        <Link to={generatePath(ROUTES.diagnosticsPlan, { type: "lab-tests" })} className="co-back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="co-title co-title--v2">{HeaderTexts.cartOverview.title}</h1>
        <button
          type="button"
          className="co-clear"
          disabled={items.length === 0 || loading || clearing}
          onClick={() => void onClearAll()}
        >
          Clear all
        </button>
      </header>

      <main className="co-main co-main--v2">
        <p className="co-count">{countPhrase}</p>

        {loading ? <p className="co-muted">Loading cart…</p> : null}

        <div className="co-list co-list--v2" aria-label="Cart items">
          {!loading && items.length === 0 ? (
            <p className="co-muted">Your cart is empty. Add tests from Lab Tests.</p>
          ) : null}
          {items.map((it) => (
            <article key={it.id} className="co-card">
              <div className="co-card__text">
                <div className="co-card__title">{it.product?.name ?? "Lab test"}</div>
                {it.product?.category ? (
                  <span className="co-card__tag">{it.product.category}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="co-card__x"
                aria-label="Remove item"
                disabled={removingId === it.id}
                onClick={() => void onRemove(it.id)}
              >
                ×
              </button>
            </article>
          ))}
        </div>

        {!loading && items.length > 0 ? (
          <section className="co-summary" aria-label="Price summary">
            <h2 className="co-summary__title">Price Summary</h2>
            <div className="co-summary__row">
              <span className="co-summary__k">Wallet Balance</span>
              <span className="co-summary__v co-summary__v--green">
                {walletBalance != null ? `₹ ${formatInr(walletBalance)}` : "—"}
              </span>
            </div>
            {walletCovered ? (
              <div className="co-summary__banner" role="status">
                <span className="co-summary__banner-ic" aria-hidden="true">
                  ✓
                </span>
                <span>Covered by wallet — No payment needed</span>
              </div>
            ) : pricing?.isPaymentRequired ? (
              <div className="co-summary__banner co-summary__banner--due" role="status">
                Payment required at checkout
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="co-footer co-footer--v2">
        <button
          type="button"
          className="co-cta"
          disabled={items.length === 0 || loading}
          onClick={() => navigate(generatePath(ROUTES.diagnosticsVendors, { type: "lab-tests" }))}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
