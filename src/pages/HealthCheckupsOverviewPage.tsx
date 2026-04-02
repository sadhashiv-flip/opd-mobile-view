import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import "./HealthCheckupsOverviewPage.css";

export function HealthCheckupsOverviewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const pageTitle = type === "lab-tests" ? "Lab Tests" : "Health Checkups";
  const vendorId = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.diagnostics.vendorId") ?? "";
    } catch {
      return "";
    }
  }, []);

  const slotLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.diagnostics.slotLabel") ?? "";
    } catch {
      return "";
    }
  }, []);

  const [altPhone, setAltPhone] = useState("");

  return (
    <div className="hco-page">
      <header className="hco-top">
        <Link
          to={generatePath(ROUTES.diagnosticsSlots, { type })}
          className="hco-back"
          aria-label="Back to slots"
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
        <h1 className="hco-title">{pageTitle}</h1>
        <Link to={ROUTES.orders} className="hco-orders">
          <span className="hco-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          My Orders
        </Link>
      </header>

      <div className="hco-loc">
        <span className="hco-loc__pin" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
              fill="#FF541E"
            />
            <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
          </svg>
        </span>
        <span className="hco-loc__title">Home</span>
        <span className="hco-loc__sep" aria-hidden="true">
          |
        </span>
        <span className="hco-loc__addr">Isprout, 7th floor, Plot No: 25, Divyasree trinity,</span>
        <span className="hco-loc__chev" aria-hidden="true">
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

      <main className="hco-main">
        <div className="hco-main__content">
        <div className="hco-subhead">
          <span className="hco-subhead__title">Added Items(1)</span>
        </div>

        <section className="hco-item">
          <div className="hco-item__row">
            <div className="hco-item__text">
              <div className="hco-item__name">Employee Annual Health Checkup</div>
              <div className="hco-item__meta">{vendorId ? `Vendor: ${vendorId}` : "For Kalyan"}</div>
            </div>
            <div className="hco-item__price">₹ 4,000</div>
          </div>
        </section>

        <section className="hco-block">
          <div className="hco-label">Phone number : +91 73********</div>
          <div className="hco-help">Booking related updates will be sent on this number</div>
        </section>

        <section className="hco-block">
          <div className="hco-label">Alternate Phone number</div>
          <div className="hco-alt">
            <span className="hco-alt__cc">+91</span>
            <input
              className="hco-alt__input"
              placeholder="Enter your alternate number here"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
            />
          </div>
        </section>

        <section className="hco-block">
          <div className="hco-label">Date and time</div>
          <div className="hco-dt">
            <span className="hco-dt__value">{slotLabel || "April 10, 2024 | 2PM–3PM"}</span>
            <button type="button" className="hco-dt__edit" aria-label="Edit date and time">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                  stroke="#1A73E8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section className="hco-totals">
          <div className="hco-totals__row">
            <span className="hco-totals__k">Total MRP</span>
            <span className="hco-totals__v">₹ 4,000</span>
          </div>
          <div className="hco-totals__row hco-totals__muted">
            <span className="hco-totals__k">Home Collection Charges</span>
            <span className="hco-totals__v">₹ 80</span>
          </div>

          <div className="hco-wallet">
            <div className="hco-wallet__left">
              <div className="hco-wallet__k">From Wallet</div>
              <div className="hco-wallet__sub">Wallet Limit : ₹ 4,600</div>
            </div>
            <div className="hco-wallet__v">₹ 4,000</div>
          </div>

          <div className="hco-net">
            <span className="hco-net__k">Net Pay</span>
            <span className="hco-net__v">
              <span className="hco-net__strike">₹ 4,080</span> ₹ 0
            </span>
          </div>
        </section>

        <section className="hco-coins">
          <span className="hco-coins__text">Flip Coins to be earned (1%):</span>
          <span className="hco-coins__pill">
            <span className="hco-coins__coin" aria-hidden="true">
              ₹
            </span>
            400
            <span className="hco-coins__worth">Worth ₹ 40</span>
          </span>
        </section>

        <p className="hco-coins__note">
          Note : Flip Coins will be credited after order completion
        </p>

        <div className="hco-remarks">
          <div className="hco-remarks__k">Remarks :</div>
          <div className="hco-remarks__v">Order cannot be cancelled once confirmed</div>
        </div>
        </div>

        <footer className="hco-paybar">
          <button
            type="button"
            className="hco-paybar__btn"
            onClick={() => navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type }))}
          >
            <span className="hco-paybar__amt">₹ 0</span>
            <span className="hco-paybar__label">Confirm and pay</span>
          </button>
        </footer>
      </main>
    </div>
  );
}

