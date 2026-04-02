import { ROUTES } from "@/constants";
import { Link, generatePath, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import "./CartOverviewPage.css";

type CartItem = Readonly<{
  id: string;
  title: string;
  subtitle: string;
}>;

const CART_STORAGE_KEY = "opd-mobile-view.lab.cartIds";

export function CartOverviewPage() {
  const navigate = useNavigate();

  const items = useMemo((): readonly CartItem[] => {
    let ids: readonly string[] = [];
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      ids = [];
    }

    if (ids.length === 0) return [];

    // Keep UI aligned with the screenshot: title + fixed subtitle.
    return ids.map((id) => ({
      id,
      title: "Bilirubin (total, direct and indirect)",
      subtitle: "Reports within 48 hours",
    }));
  }, []);

  const countLabel = `${items.length} ${items.length === 1 ? "test" : "tests"}`;

  return (
    <div className="co-page">
      <header className="co-top">
        <Link to={ROUTES.diagnosticsPlan} className="co-back" aria-label="Back">
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
        <h1 className="co-title">Cart Overview</h1>
      </header>

      <main className="co-main">
        <div className="co-info">
          <span className="co-info__ic" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
              <path d="M12 10v6" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 7h.01" stroke="#FF541E" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <span>Order info</span>
        </div>

        <div className="co-list" aria-label="Cart items">
          {items.map((it) => (
            <article key={it.id} className="co-item">
              <div className="co-item__text">
                <div className="co-item__title">{it.title}</div>
                <div className="co-item__sub">{it.subtitle}</div>
              </div>
              <div className="co-item__actions">
                <button type="button" className="co-icon-btn" aria-label="Remove item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 7h16"
                      stroke="#9A9A9A"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10 11v7"
                      stroke="#9A9A9A"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 11v7"
                      stroke="#9A9A9A"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6 7l1 14h10l1-14"
                      stroke="#9A9A9A"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 7V4h6v3"
                      stroke="#9A9A9A"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button type="button" className="co-icon-btn co-icon-btn--edit" aria-label="Edit item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4z"
                      stroke="#1A73E8"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.5 6.5 17.5 10.5"
                      stroke="#1A73E8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="co-footer" aria-label="Cart footer">
        <div className="co-footer__inner">
          <div className="co-footer__left">{countLabel}</div>
          <button
            type="button"
            className="co-footer__btn"
            onClick={() => navigate(generatePath(ROUTES.diagnosticsVendors, { type: "lab-tests" }))}
          >
            <span>Continue</span>
            <span className="co-footer__go" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10 7l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}

