import { ROUTES } from "@/constants";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import "./DiagnosticsScreenPage.css";

export function DiagnosticsScreenPage() {
  const navigate = useNavigate();
  const vendors = useMemo(
    () => [
      { id: "thyrocare", name: "Thyrocare", meta: "Home collection available" },
      { id: "apollo", name: "Apollo Diagnostics", meta: "Fast reports" },
      { id: "1mg", name: "Tata 1mg", meta: "Popular" },
    ],
    [],
  );
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0].id);

  return (
    <div className="ds-page">
      <header className="ds-top">
        <Link
          to={ROUTES.healthCheckupsPlan}
          className="ds-back"
          aria-label="Back to Health Checkups plan"
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
        <h1 className="ds-title">Diagnostics</h1>
      </header>

      <main className="ds-main">
        <h2 className="ds-subtitle">Choose vendor</h2>

        <div className="ds-vendors" role="radiogroup" aria-label="Vendors">
          {vendors.map((v) => {
            const selected = v.id === selectedVendorId;
            return (
              <button
                key={v.id}
                type="button"
                className={`ds-vendor${selected ? " ds-vendor--selected" : ""}`}
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedVendorId(v.id)}
              >
                <span className="ds-vendor__dot" aria-hidden="true" />
                <span className="ds-vendor__text">
                  <span className="ds-vendor__name">{v.name}</span>
                  <span className="ds-vendor__meta">{v.meta}</span>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="ds-footer">
        <button
          type="button"
          className="ds-continue"
          onClick={() => {
            try {
              localStorage.setItem("opd-mobile-view.diagnostics.vendorId", selectedVendorId);
            } catch {
              // ignore storage errors
            }
            navigate(ROUTES.diagnosticsSlots);
          }}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}

