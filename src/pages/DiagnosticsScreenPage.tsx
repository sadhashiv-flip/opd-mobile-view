import { ROUTES } from "@/constants";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import "./DiagnosticsScreenPage.css";

type VendorMode = "home" | "center";

type Vendor = Readonly<{
  id: string;
  name: string;
  rating: number;
  address: string;
  distanceLabel?: string;
  planName: string;
  planFor: string;
  priceBadge: string;
  toPay: number;
  modes: readonly VendorMode[];
}>;

export function DiagnosticsScreenPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const vendors = useMemo(
    (): readonly Vendor[] => [
      {
        id: "neuberg",
        name: "Neuberg Diagnostics",
        rating: 4.5,
        address: "Home Collection",
        planName: "Flip Health AHC 2025-2026",
        planFor: "for Kalyan",
        priceBadge: "Free",
        toPay: 0,
        modes: ["home"],
      },
      {
        id: "orange-health",
        name: "Orange Health Labs",
        rating: 4.5,
        address:
          "3rd & 4th floor, Bright Square, Dharam Karan Rd, ShivBagh, Ameerpet, Hyderabad, Telangana 500016",
        distanceLabel: "1 km",
        planName: "Flip Health AHC 2025-2026",
        planFor: "for Kalyan",
        priceBadge: "Free",
        toPay: 0,
        modes: ["home", "center"],
      },
    ],
    [],
  );
  const [mode, setMode] = useState<VendorMode>("home");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const visibleVendors = useMemo(
    () => vendors.filter((v) => v.modes.includes(mode)),
    [vendors, mode],
  );

  return (
    <div className="ds-page">
      <header className="ds-top">
        <Link
          to={generatePath(ROUTES.diagnosticsPlan, { type })}
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
        <h1 className="ds-title">Health Checkups</h1>
      </header>

      <main className="ds-main">
        <div className="ds-location" aria-label="Location">
          <span className="ds-location__pin" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                fill="#FF541E"
              />
              <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
            </svg>
          </span>
          <span className="ds-location__title">Home</span>
          <span className="ds-location__sep" aria-hidden="true">
            |
          </span>
          <span className="ds-location__addr">
            Isprout, 7th floor, Plot No: 25, Divyasree trinity,
          </span>
          <span className="ds-location__chev" aria-hidden="true">
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

        <div className="ds-mode" role="tablist" aria-label="Service mode">
          <button
            type="button"
            className={`ds-mode__pill${mode === "home" ? " ds-mode__pill--active" : ""}`}
            role="tab"
            aria-selected={mode === "home"}
            onClick={() => {
              setMode("home");
              setSelectedVendorId(null);
            }}
          >
            Home Collection
          </button>
          <button
            type="button"
            className={`ds-mode__pill${mode === "center" ? " ds-mode__pill--active" : ""}`}
            role="tab"
            aria-selected={mode === "center"}
            onClick={() => {
              setMode("center");
              setSelectedVendorId(null);
            }}
          >
            At Center
          </button>
        </div>

        <div className="ds-vendors" aria-label="Vendors">
          {visibleVendors.map((v) => {
            const selected = v.id === selectedVendorId;
            return (
              <button
                key={v.id}
                type="button"
                className={`ds-vendor-card${selected ? " ds-vendor-card--selected" : ""}`}
                aria-pressed={selected}
                onClick={() => setSelectedVendorId(v.id)}
              >
                <div className="ds-vendor-card__top">
                  <div className="ds-vendor-card__brand">
                    <div className="ds-vendor-card__name">{v.name}</div>
                    <span className="ds-vendor-card__rating" aria-label={`Rating ${v.rating}`}>
                      ★ {v.rating.toFixed(1)}
                    </span>
                  </div>

                  <span
                    className={`ds-vendor-card__check${selected ? " ds-vendor-card__check--on" : ""}`}
                    aria-hidden="true"
                  >
                    {selected ? "✓" : ""}
                  </span>
                </div>

                <div className="ds-vendor-card__addr">
                  <div className="ds-vendor-card__addr-text">{v.address}</div>
                  {v.distanceLabel ? (
                    <div className="ds-vendor-card__addr-side">
                      <div className="ds-vendor-card__distance">{v.distanceLabel}</div>
                    </div>
                  ) : null}
                </div>

                <div className="ds-vendor-card__plan">
                  <div className="ds-vendor-card__plan-left">
                    <div className="ds-vendor-card__plan-name">{v.planName}</div>
                    <div className="ds-vendor-card__plan-for">{v.planFor}</div>
                  </div>
                  <span className="ds-vendor-card__free">{v.priceBadge}</span>
                </div>

                <div className="ds-vendor-card__pay">
                  <span className="ds-vendor-card__pay-label">To Pay</span>
                  <span className="ds-vendor-card__pay-amt">₹ {v.toPay}</span>
                </div>

                <div className={`ds-vendor-card__footer${mode === "home" ? " ds-vendor-card__footer--home" : ""}`}>
                  {mode === "home" ? "Home Collection" : "At Center"}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="ds-footer">
        <button
          type="button"
          className="ds-continue"
          disabled={!selectedVendorId}
          onClick={() => {
            if (!selectedVendorId) return;
            try {
              localStorage.setItem("opd-mobile-view.diagnostics.vendorId", selectedVendorId);
              localStorage.setItem("opd-mobile-view.diagnostics.vendorMode", mode);
            } catch {
              // ignore storage errors
            }
            navigate(generatePath(ROUTES.diagnosticsSlots, { type }));
          }}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}

