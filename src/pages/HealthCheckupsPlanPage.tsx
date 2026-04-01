import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import "./HealthCheckupsPlanPage.css";

type Plan = Readonly<{
  id: string;
  name: string;
  priceBadge: string;
  fastingNote?: string;
  bullets: readonly string[];
  footerTag: string;
}>;

export function HealthCheckupsPlanPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const pageTitle = type === "lab-tests" ? "Lab Tests" : "Health Checkups";

  const plans: readonly Plan[] = [
    {
      id: "p1",
      name: "Flip health AHC 2025-2026",
      priceBadge: "Free",
      fastingNote: "This test requires fasting for 12 hours",
      bullets: ["Reports within 48 hours", "Instant confirmation", "From the comfort of your home"],
      footerTag: "Home Collection",
    },
    {
      id: "p2",
      name: "Executive Health Checkup",
      priceBadge: "Free",
      fastingNote: "This test requires fasting for 10 hours",
      bullets: ["Reports within 24 hours", "Instant confirmation", "Home sample pickup"],
      footerTag: "Home Collection",
    },
    {
      id: "p3",
      name: "Annual Wellness Panel",
      priceBadge: "Free",
      bullets: ["Reports within 48 hours", "Instant confirmation", "At center available"],
      footerTag: "At Center",
    },
    {
      id: "p4",
      name: "Corporate Health Checkup",
      priceBadge: "Free",
      bullets: ["Reports within 48 hours", "Instant confirmation", "Home sample pickup"],
      footerTag: "Home Collection",
    },
  ];

  const pageSize = 2;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(plans.length / pageSize));
  const visiblePlans = useMemo(() => {
    const start = (page - 1) * pageSize;
    return plans.slice(start, start + pageSize);
  }, [page, plans]);
  return (
    <div className="hcp-page">
      <header className="hcp-top">
        <Link
          to={generatePath(ROUTES.diagnosticsType, { type })}
          className="hcp-back"
          aria-label={`Back to ${pageTitle}`}
        >
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
        <h1 className="hcp-title">{pageTitle}</h1>
        <Link to={ROUTES.orders} className="hcp-orders">
          <span className="hcp-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          My Orders
        </Link>
      </header>

      <main className="hcp-main">
        <div className="hcp-loc">
          <span className="hcp-loc__pin" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                fill="#FF541E"
              />
              <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
            </svg>
          </span>
          <span className="hcp-loc__title">Home</span>
          <span className="hcp-loc__sep" aria-hidden="true">
            |
          </span>
          <span className="hcp-loc__addr">Isprout, 7th floor, Plot No: 25, Divyasree trinity,</span>
          <span className="hcp-loc__chev" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <div className="hcp-plans" aria-label="Plans list">
          <div className="hcp-plans__head">
            <div className="hcp-plans__title">Plans</div>
            <div className="hcp-plans__pager" aria-label="Plans pagination">
              <button
                type="button"
                className="hcp-pagebtn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <span className="hcp-pagecount">
                {page}/{pageCount}
              </span>
              <button
                type="button"
                className="hcp-pagebtn"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
              >
                Next
              </button>
            </div>
          </div>

          {visiblePlans.map((plan) => (
            <section
              key={plan.id}
              className="hcp-card hcp-card--interactive"
              aria-label={`Plan ${plan.name}`}
              role="button"
              tabIndex={0}
              onClick={() => navigate(generatePath(ROUTES.diagnosticsVendors, { type }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(generatePath(ROUTES.diagnosticsVendors, { type }));
                }
              }}
            >
              <div className="hcp-card__top">
                <h2 className="hcp-card__name">{plan.name}</h2>
                <span className="hcp-pill">{plan.priceBadge}</span>
              </div>

              <button type="button" className="hcp-link" onClick={(e) => e.preventDefault()}>
                See what&apos;s included &gt;
              </button>

              {plan.fastingNote ? (
                <div className="hcp-warn">
                  <span className="hcp-warn__ic" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                      <path d="M12 7v6" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 17h.01" stroke="#FF541E" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="hcp-warn__text">{plan.fastingNote}</span>
                </div>
              ) : null}

              <ul className="hcp-list">
                {plan.bullets.map((b, idx) => (
                  <li key={`${plan.id}-${idx}`} className="hcp-li">
                    <span className="hcp-li__ic" aria-hidden="true">
                      {idx === 0 ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 8v4l3 1.5"
                            stroke="#FF541E"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                        </svg>
                      ) : idx === 1 ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 2l2.6 6.9L22 9.2l-5.6 4.6L18 21l-6-3.5L6 21l1.6-7.2L2 9.2l6.8-.3L12 2z"
                            fill="#FF541E"
                            opacity="0.9"
                          />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M20 6L9 17l-5-5"
                            stroke="#2E7D32"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    {b}
                  </li>
                ))}
              </ul>

              <div className="hcp-bottom">
                <span className="hcp-home-ic" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 10.5L12 3l9 7.5V21H3V10.5z"
                      fill="#ffffff"
                      opacity="0.95"
                    />
                  </svg>
                </span>
                {plan.footerTag}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="hcp-footer">
        <button type="button" className="hcp-continue">
          Continue
        </button>
      </footer>
    </div>
  );
}

