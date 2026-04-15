import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import {
  DIAG_LAB_VENDOR_CODE_KEY,
  DIAG_LAB_VENDOR_NAME_KEY,
} from "@/constants/diagnosticsLabFlowStorage";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  readSelectedAddress,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";
import { getPatientApiRootBase } from "@/api/patientClient";
import { useSelectedAddressLine, useSelectedAddressTag } from "@/hooks/useSelectedAddressLine";
import { useToast } from "@/hooks/useToast";
import {
  fetchDiagnosticVendorsPricing,
  type DiagnosticVendorPricingRow,
} from "@/api/patientDiagnosticsLab";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

function labVendorImageBase(): string {
  const fromEnv = import.meta.env.VITE_IMAGE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return getPatientApiRootBase().replace(/\/$/, "");
}

function vendorLogoUrl(logo: string | null): string | null {
  if (!logo?.trim()) return null;
  const path = logo.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = labVendorImageBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function DiagnosticsScreenPage() {
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isLabTests = type === "lab-tests";
  const selectedAddressId = useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.id?.trim() ?? "",
    () => "",
  );

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

  const [labApiVendors, setLabApiVendors] = useState<readonly DiagnosticVendorPricingRow[]>([]);
  const [labApiLoading, setLabApiLoading] = useState(false);
  const [labApiError, setLabApiError] = useState<string | null>(null);
  const [labSelectedCode, setLabSelectedCode] = useState("");

  useEffect(() => {
    if (!isLabTests) return;
    const addr = readSelectedAddress();
    if (!addr?.id.trim()) {
      setLabApiVendors([]);
      setLabApiError("Choose a saved address to see labs.");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLabApiLoading(true);
      setLabApiError(null);
      try {
        const pricingRows = await fetchDiagnosticVendorsPricing(addr.id.trim());
        if (cancelled) return;
        setLabApiVendors(pricingRows);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load labs";
          setLabApiError(msg);
          setLabApiVendors([]);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLabApiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLabTests, selectedAddressId, toast]);

  useEffect(() => {
    if (!isLabTests) return;
    setLabSelectedCode("");
  }, [isLabTests, selectedAddressId]);

  const dsLocAddrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);
  const dsLocTag = useSelectedAddressTag("HOME");

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
          <h1 className="ds-title">Select Lab</h1>
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
            <span className="ds-location__title">{dsLocTag}</span>
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

          <p className="ds-sellab-hint">Choose a lab for your tests</p>

          <div className="ds-vendors ds-vendors--lab" aria-label="Vendors">
            {labApiLoading ? <p className="ds-location__addr">Loading labs…</p> : null}
            {labApiError && !labApiLoading ? (
              <p className="ds-location__addr" role="alert">
                {labApiError}
              </p>
            ) : null}
            {!labApiLoading && !labApiError && labApiVendors.length === 0 ? (
              <p className="ds-location__addr">
                No lab is available for your cart at this address. Add tests or try another address.
              </p>
            ) : null}
            {labApiVendors.map((v) => {
              const sel = v.code === labSelectedCode;
              const subtotal = v.packages.reduce((a, p) => a + (p.b2cPrice ?? 0), 0);
              const formatInr = (n: number) =>
                n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
              const logoSrc = vendorLogoUrl(v.logo);
              return (
                <button
                  key={v.code || String(v.id)}
                  type="button"
                  className={`ds-lab-card ds-lab-card--sel${sel ? " ds-lab-card--selected" : ""}`}
                  onClick={() => setLabSelectedCode(v.code)}
                >
                  <div className="ds-lab-card__top ds-lab-card__top--sel">
                    <div className="ds-lab-card__brand ds-lab-card__brand--sel">
                      {logoSrc ? (
                        <img className="ds-sellab-logo" src={logoSrc} alt="" width={40} height={40} />
                      ) : (
                        <span className="ds-sellab-logo-fallback" aria-hidden="true">
                          {v.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="ds-lab-card__logo ds-lab-card__logo--sel">{v.name}</span>
                    </div>
                    <span
                      className={`ds-sellab-check${sel ? " ds-sellab-check--on" : ""}`}
                      aria-hidden="true"
                    >
                      {sel ? "✓" : ""}
                    </span>
                  </div>

                  <div className="ds-sellab-home">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M3 10.5L12 3l9 7.5V21H3V10.5z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Home Collection</span>
                  </div>

                  <div className="ds-sellab-pack">
                    {v.packages.map((p) => (
                      <div key={p.id} className="ds-sellab-line">
                        <span className="ds-sellab-line__name">{p.name}</span>
                        <span className="ds-sellab-line__price">₹{formatInr(p.b2cPrice ?? 0)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="ds-sellab-total">
                    <span>Total</span>
                    <span>₹{formatInr(subtotal)}</span>
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
            disabled={!labSelectedCode || labApiVendors.length === 0}
            onClick={() => {
              const v = labApiVendors.find((x) => x.code === labSelectedCode);
              try {
                localStorage.setItem("opd-mobile-view.diagnostics.vendorId", labSelectedCode);
                localStorage.setItem("opd-mobile-view.diagnostics.vendorMode", "home");
                localStorage.setItem(DIAG_LAB_VENDOR_CODE_KEY, labSelectedCode);
                localStorage.setItem(DIAG_LAB_VENDOR_NAME_KEY, v?.name ?? "");
              } catch {
                // ignore
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
