import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { DEFAULT_LOCATION_ADDRESS_LINE } from "@/constants/selectedAddressStorage";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import "./HealthCheckupsPlanPage.css";

type Plan = Readonly<{
  id: string;
  name: string;
  priceBadge: string;
  fastingNote?: string;
  bullets: readonly string[];
  footerTag: string;
}>;

type LabTest = Readonly<{
  id: string;
  title: string;
  price: number;
  footerTag: "Home Collection" | "At Center";
}>;

const LAB_CART_STORAGE_KEY = "opd-mobile-view.lab.cartIds";

export function HealthCheckupsPlanPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const pageTitle = type === "lab-tests" ? "Lab Tests" : "Health Checkups";
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hcpLocAddrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);

  const labTests: readonly LabTest[] = useMemo(
    () => [
      { id: "lt1", title: "Basic Diagnostic Package - Home Collection", price: 6000, footerTag: "Home Collection" },
      { id: "lt2", title: "Full Body Checkup - Home Collection", price: 7999, footerTag: "Home Collection" },
      { id: "lt3", title: "Diabetes Screening - Home Collection", price: 2999, footerTag: "Home Collection" },
    ],
    [],
  );

  const [labQuery, setLabQuery] = useState("");
  const [labActiveIdx, setLabActiveIdx] = useState(0);
  const labCarouselRef = useRef<HTMLDivElement | null>(null);
  const [labCartIds, setLabCartIds] = useState<readonly string[]>([]);

  useEffect(() => {
    // Reset selection when switching between Health Checkups and Lab Tests
    setSelectedPlanId(null);
    setLabCartIds([]);
  }, [type]);

  useEffect(() => {
    if (type !== "lab-tests") return;
    try {
      localStorage.setItem(LAB_CART_STORAGE_KEY, JSON.stringify(labCartIds));
    } catch {
      // ignore
    }
  }, [labCartIds, type]);

  useEffect(() => {
    if (type !== "lab-tests") return;
    // Keep dots in sync on resize
    const onResize = () => setLabActiveIdx(0);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [type]);

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

  const continueToVendors = () => {
    if (!selectedPlanId) return;
    navigate(generatePath(ROUTES.diagnosticsVendors, { type }));
  };

  const renderBulletIcon = (idx: number) => {
    if (idx === 0) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 8v4l3 1.5"
            stroke="#FF541E"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
        </svg>
      );
    }
    if (idx === 1) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l2.6 6.9L22 9.2l-5.6 4.6L18 21l-6-3.5L6 21l1.6-7.2L2 9.2l6.8-.3L12 2z"
            fill="#FF541E"
            opacity="0.9"
          />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke="#2E7D32"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const formatInr = (value: number) =>
    value.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const scrollToLabSlide = (idx: number) => {
    const el = labCarouselRef.current;
    if (!el) return;
    const child = el.children.item(idx) as HTMLElement | null;
    if (!child) return;
    child.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const addToCart = (id: string) => {
    setLabCartIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

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
          <span>My Orders</span>
        </Link>
      </header>

      <main className="hcp-main">
        <button
          type="button"
          className="hcp-loc"
          aria-label="Choose address"
          onClick={() => setAddrSheetOpen(true)}
        >
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
          <span className="hcp-loc__addr">{hcpLocAddrLine}</span>
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
        </button>

        <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />

        {type === "lab-tests" ? (
          <div className="lt-wrap">
            <div className="lt-search" role="search">
              <span className="lt-search__ic" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                    stroke="#9A9A9A"
                    strokeWidth="2"
                  />
                  <path
                    d="M16.2 16.2 21 21"
                    stroke="#9A9A9A"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                className="lt-search__input"
                placeholder="Search and book lab tests"
                value={labQuery}
                onChange={(e) => setLabQuery(e.target.value)}
                aria-label="Search and book lab tests"
              />
              <span className="lt-search__divider" aria-hidden="true" />
              <button type="button" className="lt-search__mic" aria-label="Voice search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M19 11a7 7 0 0 1-14 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <section className="lt-section" aria-label="Popular Lab Tests">
              <header className="lt-section__head">
                <h2 className="lt-section__title">Popular Lab Tests</h2>
                <p className="lt-section__sub">Best in class service rating</p>
              </header>

              <div
                ref={labCarouselRef}
                className="lt-carousel"
                onScroll={() => {
                  const el = labCarouselRef.current;
                  if (!el) return;
                  const first = el.children.item(0) as HTMLElement | null;
                  if (!first) return;
                  const slideW = first.getBoundingClientRect().width + 12;
                  const nextIdx = Math.round(el.scrollLeft / Math.max(1, slideW));
                  setLabActiveIdx(Math.max(0, Math.min(labTests.length - 1, nextIdx)));
                }}
              >
                {labTests.map((t) => (
                  <article key={t.id} className="lt-card">
                    <h3 className="lt-card__title">{t.title}</h3>
                    <button type="button" className="lt-card__link">
                      See what&apos;s included &gt;
                    </button>
                    <div className="lt-card__row">
                      <div className="lt-card__price">₹ {formatInr(t.price)}</div>
                      <button
                        type="button"
                        className="lt-card__cta"
                        onClick={() => addToCart(t.id)}
                      >
                        {labCartIds.includes(t.id) ? "Added" : "Add to cart"}
                      </button>
                    </div>
                    <div className="lt-card__footer">
                      <span className="lt-home-ic" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M3 10.5L12 3l9 7.5V21H3V10.5z"
                            fill="#ffffff"
                            opacity="0.95"
                          />
                        </svg>
                      </span>
                  <span>{t.footerTag}</span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="lt-dots" role="tablist" aria-label="Lab tests slides">
                {labTests.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`lt-dot${idx === labActiveIdx ? " lt-dot--active" : ""}`}
                    role="tab"
                    aria-selected={idx === labActiveIdx}
                    aria-label={`Slide ${idx + 1} of ${labTests.length}`}
                    onClick={() => scrollToLabSlide(idx)}
                  />
                ))}
              </div>
            </section>

            <section className="lt-section lt-trust" aria-label="Top Labs, Trusted Care">
              <h2 className="lt-section__title">Top Labs, Trusted Care</h2>
              <div className="lt-trust__card">
                <div className="lt-trust__rating">
                  <span className="lt-trust__star" aria-hidden="true">
                    ★
                  </span>
                  <span className="lt-trust__rating-text">
                    <strong>4.5</strong> <span>Avg. user rating</span>
                  </span>
                </div>
                <ul className="lt-trust__list">
                  <li className="lt-trust__li">
                    <span className="lt-trust__ic" aria-hidden="true">
                      ⏱
                    </span>
                    <span>Reports within 48 hours</span>
                  </li>
                  <li className="lt-trust__li">
                    <span className="lt-trust__ic" aria-hidden="true">
                      ⚡
                    </span>
                    <span>Instant confirmation</span>
                  </li>
                  <li className="lt-trust__li">
                    <span className="lt-trust__ic lt-trust__ic--ok" aria-hidden="true">
                      ✓
                    </span>
                    <span>From the comfort of your home</span>
                  </li>
                </ul>
              </div>
            </section>

            {labCartIds.length > 0 ? (
              <footer className="lt-cart-footer" aria-label="Cart">
                <div className="lt-cart-footer__inner">
                  <div className="lt-cart-footer__left">
                    {labCartIds.length} {labCartIds.length === 1 ? "test" : "tests"}
                  </div>
                  <button
                    type="button"
                    className="lt-cart-footer__btn"
                    onClick={() => navigate(ROUTES.cartOverview)}
                  >
                    <span>View cart</span>
                    <span className="lt-cart-footer__ic" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6.5 6h15l-1.5 8.5H8L6.5 6z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.5 6 5.8 3.8H3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle cx="9" cy="19" r="1.6" fill="currentColor" />
                        <circle cx="18" cy="19" r="1.6" fill="currentColor" />
                      </svg>
                    </span>
                  </button>
                </div>
              </footer>
            ) : null}
          </div>
        ) : (
        <div className="hcp-plans" aria-label="Plans list" role="radiogroup">
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
            <button
              key={plan.id}
              className={`hcp-card hcp-card--interactive${selectedPlanId === plan.id ? " hcp-card--selected" : ""}`}
              aria-label={`Plan ${plan.name}`}
              type="button"
              aria-pressed={selectedPlanId === plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="hcp-card__top">
                <h2 className="hcp-card__name">{plan.name}</h2>
                <span className="hcp-pill">{plan.priceBadge}</span>
              </div>

              <span className="hcp-link" aria-hidden="true">
                See what&apos;s included &gt;
              </span>

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
                      {renderBulletIcon(idx)}
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
            </button>
          ))}
        </div>
        )}
      </main>

      {type === "lab-tests" ? null : (
        <footer className="hcp-footer">
          <button
            type="button"
            className="hcp-continue"
            disabled={!selectedPlanId}
            onClick={continueToVendors}
          >
            Continue
          </button>
        </footer>
      )}
    </div>
  );
}

