import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { DEFAULT_LOCATION_ADDRESS_LINE } from "@/constants/selectedAddressStorage";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
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

type LabFilter = "home" | "center" | "radiology";

const LAB_CART_KEY = "opd-mobile-view.lab.cartIds";

export function DiagnosticsScreenPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isLabTests = type === "lab-tests";

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
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);

  const visibleVendors = useMemo(
    () => vendors.filter((v) => v.modes.includes(mode)),
    [vendors, mode],
  );

  const cartIdsForLines = useMemo((): readonly string[] => {
    if (!isLabTests) return ["lt1", "lt2"];
    try {
      const raw = localStorage.getItem(LAB_CART_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
      return ids.length > 0 ? ids : ["lt1", "lt2"];
    } catch {
      return ["lt1", "lt2"];
    }
  }, [isLabTests]);

  const cartLineCount = cartIdsForLines.length;

  const [labFilter, setLabFilter] = useState<LabFilter>("home");
  const [labSelectedId, setLabSelectedId] = useState<string>("neuberg");

  const labPricesNeuberg = useMemo(() => {
    const prices: number[] = [];
    for (let i = 0; i < cartLineCount; i++) {
      prices.push(i === 0 ? 300 : 210);
    }
    return prices;
  }, [cartLineCount]);

  const labPricesOrange = useMemo(() => {
    const prices: number[] = [];
    for (let i = 0; i < cartLineCount; i++) {
      prices.push(210);
    }
    return prices;
  }, [cartLineCount]);

  const collectionCharge = 80;
  const totalNeuberg = labPricesNeuberg.reduce((a, b) => a + b, 0) + collectionCharge;
  const totalOrange = labPricesOrange.reduce((a, b) => a + b, 0) + collectionCharge;

  const testTitle = "Bilirubin (total, direct and indirect)";

  const dsLocAddrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);

  if (isLabTests) {
    return (
      <>
      <div className="ds-page ds-page--lab">
        <header className="ds-top">
          <Link
            to={ROUTES.cartOverview}
            className="ds-back ds-back--lab"
            aria-label="Back to cart"
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
          <h1 className="ds-title">Lab Tests</h1>
          <Link to={ROUTES.orders} className="ds-orders">
            <span className="ds-orders__ic" aria-hidden="true">
              <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
            </span>
            <span>My Orders</span>
          </Link>
        </header>

        <main className="ds-main">
          <button
            type="button"
            className="ds-location"
            aria-label="Choose address"
            onClick={() => setAddrSheetOpen(true)}
          >
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
            <span className="ds-location__addr">{dsLocAddrLine}</span>
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
          </button>

          <div className="ds-mode ds-mode--scroll" role="tablist" aria-label="Service type">
            <button
              type="button"
              className={`ds-mode__pill ds-mode__pill--icon${labFilter === "home" ? " ds-mode__pill--active" : ""}`}
              role="tab"
              aria-selected={labFilter === "home"}
              onClick={() => setLabFilter("home")}
            >
              <span className="ds-mode__pill-ic" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 10.5L12 3l9 7.5V21H3V10.5z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>Home Collection</span>
            </button>
            <button
              type="button"
              className={`ds-mode__pill ds-mode__pill--icon${labFilter === "center" ? " ds-mode__pill--active" : ""}`}
              role="tab"
              aria-selected={labFilter === "center"}
              onClick={() => setLabFilter("center")}
            >
              <span className="ds-mode__pill-ic" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 21V10l8-3 8 3v11"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.75" />
                </svg>
              </span>
              <span>At Center</span>
            </button>
            <button
              type="button"
              className={`ds-mode__pill ds-mode__pill--icon${labFilter === "radiology" ? " ds-mode__pill--active" : ""}`}
              role="tab"
              aria-selected={labFilter === "radiology"}
              onClick={() => setLabFilter("radiology")}
            >
              <span className="ds-mode__pill-ic" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
                  <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.75" />
                </svg>
              </span>
              <span>Radiology</span>
            </button>
          </div>

          <div className="ds-vendors ds-vendors--lab" aria-label="Vendors">
            <button
              type="button"
              className={`ds-lab-card${labSelectedId === "neuberg" ? " ds-lab-card--selected" : ""}`}
              onClick={() => setLabSelectedId("neuberg")}
            >
              <div className="ds-lab-card__top">
                <div className="ds-lab-card__brand">
                  <span className="ds-lab-card__logo">Neuberg</span>
                  <span className="ds-vendor-card__rating" aria-label="Rating 4.5">
                    ★ 4.5
                  </span>
                </div>
                <span
                  className={`ds-vendor-card__check${labSelectedId === "neuberg" ? " ds-vendor-card__check--on" : ""}`}
                  aria-hidden="true"
                >
                  {labSelectedId === "neuberg" ? "✓" : ""}
                </span>
              </div>

              <div className="ds-lab-card__lines">
                {labPricesNeuberg.map((p, i) => (
                  <div key={cartIdsForLines[i] ?? `neuberg-${String(p)}`} className="ds-lab-line">
                    <span className="ds-lab-line__name">{testTitle}</span>
                    <span className="ds-lab-line__price">₹ {p}</span>
                  </div>
                ))}
                <div className="ds-lab-line ds-lab-line--charge">
                  <span>Home Collection Charges</span>
                  <span className="ds-lab-line__price">₹ {collectionCharge}</span>
                </div>
                <div className="ds-lab-line ds-lab-line--total">
                  <span>To Pay</span>
                  <span className="ds-lab-line__total">₹ {totalNeuberg}</span>
                </div>
              </div>

              <div className="ds-lab-card__footer ds-lab-card__footer--orange">
                <span className="ds-lab-card__footer-ic" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 10.5L12 3l9 7.5V21H3V10.5z"
                      fill="#ffffff"
                      opacity="0.95"
                    />
                  </svg>
                </span>
                <span>Home Collection</span>
              </div>
            </button>

            <div
              className={`ds-lab-card ds-lab-card--wrap${labSelectedId === "orange-health" ? " ds-lab-card--selected" : ""}`}
            >
              <button
                type="button"
                className="ds-lab-card__body-btn"
                onClick={() => setLabSelectedId("orange-health")}
              >
                <div className="ds-lab-card__top">
                  <div className="ds-lab-card__brand">
                    <span className="ds-lab-card__logo ds-lab-card__logo--orange">Orange Health Labs</span>
                    <span className="ds-vendor-card__rating" aria-label="Rating 4.5">
                      ★ 4.5
                    </span>
                  </div>
                  <span
                    className={`ds-vendor-card__check${labSelectedId === "orange-health" ? " ds-vendor-card__check--on" : ""}`}
                    aria-hidden="true"
                  >
                    {labSelectedId === "orange-health" ? "✓" : ""}
                  </span>
                </div>

                <div className="ds-lab-card__addr-row">
                  <p className="ds-lab-card__addr-text">
                    3rd & 4th floor, Bright Square, Dharam Karan Rd, ShivBagh, Ameerpet, Hyderabad, Telangana 500016
                  </p>
                </div>

                <div className="ds-lab-card__lines">
                {labPricesOrange.map((p, i) => (
                  <div key={cartIdsForLines[i] ?? `orange-${String(p)}`} className="ds-lab-line">
                    <span className="ds-lab-line__name">{testTitle}</span>
                    <span className="ds-lab-line__price">₹ {p}</span>
                  </div>
                ))}
                <div className="ds-lab-line ds-lab-line--charge">
                  <span>Home Collection Charges</span>
                  <span className="ds-lab-line__price">₹ {collectionCharge}</span>
                </div>
                <div className="ds-lab-line ds-lab-line--total">
                  <span>To Pay</span>
                  <span className="ds-lab-line__total">₹ {totalOrange}</span>
                </div>
              </div>
              </button>

              <a
                href="https://www.google.com/maps/search/?api=1&query=Orange+Health+Labs+Ameerpet+Hyderabad"
                target="_blank"
                rel="noreferrer"
                className="ds-lab-card__directions"
              >
                <span className="ds-lab-card__directions-ic" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"
                      stroke="#1A73E8"
                      strokeWidth="1.6"
                    />
                    <circle cx="12" cy="9" r="2" fill="#1A73E8" />
                  </svg>
                </span>
                <span>Directions</span>
              </a>

              <div className="ds-lab-card__footer ds-lab-card__footer--split">
                <span className="ds-lab-card__footer-seg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M3 10.5L12 3l9 7.5V21H3V10.5z"
                      fill="#ffffff"
                      opacity="0.95"
                    />
                  </svg>
                  <span>Home Collection</span>
                </span>
                <span className="ds-lab-card__footer-seg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 21V10l8-3 8 3v11"
                      stroke="#ffffff"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M9 21v-6h6v6" stroke="#ffffff" strokeWidth="1.75" />
                  </svg>
                  <span>At Center</span>
                </span>
              </div>
            </div>
          </div>
        </main>

        <footer className="ds-footer">
          <button
            type="button"
            className="ds-continue"
            onClick={() => {
              try {
                localStorage.setItem("opd-mobile-view.diagnostics.vendorId", labSelectedId);
                localStorage.setItem("opd-mobile-view.diagnostics.vendorMode", "home");
              } catch {
                // ignore
              }
              navigate(generatePath(ROUTES.diagnosticsSlots, { type }));
            }}
          >
            Confirm
          </button>
        </footer>
      </div>
      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
      </>
    );
  }

  return (
    <>
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
        <button
          type="button"
          className="ds-location"
          aria-label="Choose address"
          onClick={() => setAddrSheetOpen(true)}
        >
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
          <span className="ds-location__addr">{dsLocAddrLine}</span>
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
        </button>

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
    <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
    </>
  );
}
