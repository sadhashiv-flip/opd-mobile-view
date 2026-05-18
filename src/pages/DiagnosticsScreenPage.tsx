import { ROUTES } from "@/constants";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import {
  DIAG_LAB_VENDOR_CODE_KEY,
  DIAG_LAB_VENDOR_NAME_KEY,
} from "@/constants/diagnosticsLabFlowStorage";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { getPatientApiRootBase } from "@/api/patientClient";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import { deliveryAddressChooserAriaLabel } from "@/constants/selectedAddressStorage";
import { useToast } from "@/hooks/useToast";
import {
  fetchDiagnosticVendorsPricing,
  fetchSponsoredVendorPricing,
  type DiagnosticVendorPricingRow,
  type HealthSponsoredVendorRow,
  type SponsoredVendorPricingResult,
} from "@/api/patientDiagnosticsLab";
import {
  DIAG_HEALTH_PATH_SLOT_KEY,
  DIAG_HEALTH_RAD_SLOT_KEY,
  readHealthSponsoredFlag,
  readHealthUsersPackages,
  writeHealthVendorMeta,
} from "@/constants/diagnosticsHealthFlowStorage";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./DiagnosticsScreenPage.css";

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

function clearHealthSlotSessionKeys(): void {
  try {
    globalThis.sessionStorage?.removeItem("opd-mobile-view.diagnostics.health.slotPhase");
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_PATH_SLOT_KEY);
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_RAD_SLOT_KEY);
  } catch {
    // ignore
  }
}

export function DiagnosticsScreenPage() {
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isLabTests = type === "lab-tests";
  /** Prevents duplicate auto-navigation (e.g. React Strict Mode). Reset when pricing reloads. */
  const healthAutoSlotsKeyRef = useRef<string | null>(null);
  const labEmptySlotsSkipRef = useRef(false);
  /** Lab vendor `POST` finished (or skipped with no address) — avoids auto-slots before the first fetch runs. */
  const labVendorFetchSettledRef = useRef(false);
  const selectedAddressId = useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.id?.trim() ?? "",
    () => "",
  );

  const [addrSheetOpen, setAddrSheetOpen] = useState(false);

  const [healthPricing, setHealthPricing] = useState<SponsoredVendorPricingResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [pathVendorCode, setPathVendorCode] = useState<string | null>(null);
  const [radVendorCode, setRadVendorCode] = useState<string | null>(null);

  const loadHealthPricing = useCallback(async () => {
    const rows = readHealthUsersPackages();
    if (rows.length === 0) {
      setHealthError("Go back and choose a package for each person.");
      setHealthPricing(null);
      return;
    }
    const addr = readSelectedAddress();
    if (!addr?.id.trim()) {
      setHealthError("Choose a saved address to see lab partners.");
      setHealthPricing(null);
      return;
    }
    setHealthLoading(true);
    setHealthError(null);
    healthAutoSlotsKeyRef.current = null;
    try {
      const res = await fetchSponsoredVendorPricing({
        addressId: addr.id.trim(),
        sponsored: readHealthSponsoredFlag(),
        users: rows,
      });
      setHealthPricing(res);
      const pv = res.pathologyVendors;
      const rv = res.radiologyVendors;
      setPathVendorCode(
        pv.length === 1 ? pv[0].code : pv.length === 0 && res.pathologyCategoryExists ? "unknown" : null,
      );
      setRadVendorCode(
        rv.length === 1 ? rv[0].code : rv.length === 0 && res.radiologyCategoryExists ? "unknown" : null,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load partners";
      setHealthError(msg);
      setHealthPricing(null);
      toast.error(msg);
    } finally {
      setHealthLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isLabTests) return;
    void loadHealthPricing();
  }, [isLabTests, loadHealthPricing, selectedAddressId]);

  const goHealthSlots = useCallback(
    (opts?: { replace?: boolean }) => {
      const hp = healthPricing;
      if (!hp) return;
      writeHealthVendorMeta({
        needPathology: hp.pathologyCategoryExists,
        needRadiology: hp.radiologyCategoryExists,
        pathVendorCode: hp.pathologyCategoryExists ? pathVendorCode ?? "unknown" : "unknown",
        radVendorCode: hp.radiologyCategoryExists ? radVendorCode ?? "unknown" : "unknown",
      });
      clearHealthSlotSessionKeys();
      const path = generatePath(ROUTES.diagnosticsSlots, { type });
      navigate(path, opts?.replace ? { replace: true } : undefined);
    },
    [healthPricing, pathVendorCode, radVendorCode, navigate, type],
  );

  /** Health (Dart `continueToVendorSelection`): no selectable pathology/radiology vendors → skip vendor UI, open slots. */
  useEffect(() => {
    if (isLabTests) return;
    if (healthLoading || healthError || !healthPricing) return;
    const pv = healthPricing.pathologyVendors.length;
    const rv = healthPricing.radiologyVendors.length;
    if (pv > 0 || rv > 0) return;

    const autoKey = `${selectedAddressId}|${JSON.stringify(readHealthUsersPackages())}|p${healthPricing.pathologyCategoryExists ? 1 : 0}r${healthPricing.radiologyCategoryExists ? 1 : 0}`;
    if (healthAutoSlotsKeyRef.current === autoKey) return;
    healthAutoSlotsKeyRef.current = autoKey;
    /** Replace so "Back" from slots does not remount vendors and re-run this auto-skip (would feel broken). */
    goHealthSlots({ replace: true });
  }, [
    goHealthSlots,
    healthError,
    healthLoading,
    healthPricing,
    isLabTests,
    selectedAddressId,
  ]);

  const [labApiVendors, setLabApiVendors] = useState<readonly DiagnosticVendorPricingRow[]>([]);
  const [labApiLoading, setLabApiLoading] = useState(false);
  const [labApiError, setLabApiError] = useState<string | null>(null);
  const [labSelectedCode, setLabSelectedCode] = useState("");

  useEffect(() => {
    if (!isLabTests) return;
    const addr = readSelectedAddress();
    if (!addr?.id.trim()) {
      labVendorFetchSettledRef.current = true;
      setLabApiVendors([]);
      setLabApiError("Choose a saved address to see labs.");
      return;
    }
    labVendorFetchSettledRef.current = false;
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
        if (!cancelled) {
          labVendorFetchSettledRef.current = true;
          setLabApiLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLabTests, selectedAddressId, toast]);

  useEffect(() => {
    if (!isLabTests) return;
    setLabSelectedCode("");
    labEmptySlotsSkipRef.current = false;
    labVendorFetchSettledRef.current = false;
  }, [isLabTests, selectedAddressId]);

  /** Lab (Dart `LabSelectionScreen`): no vendors → skip picker and open slots; vendor_code falls back to `unknown` like health slots. */
  const goLabSlotsWithUnknownVendor = useCallback(
    (opts?: { replace?: boolean }) => {
      try {
        globalThis.localStorage?.setItem("opd-mobile-view.diagnostics.vendorId", "unknown");
        globalThis.localStorage?.setItem("opd-mobile-view.diagnostics.vendorMode", "home");
        globalThis.localStorage?.setItem(DIAG_LAB_VENDOR_CODE_KEY, "unknown");
        globalThis.localStorage?.setItem(DIAG_LAB_VENDOR_NAME_KEY, "");
      } catch {
        // ignore
      }
      const path = generatePath(ROUTES.diagnosticsSlots, { type });
      navigate(path, opts?.replace ? { replace: true } : undefined);
    },
    [navigate, type],
  );

  useEffect(() => {
    if (!isLabTests) return;
    if (!labVendorFetchSettledRef.current || labApiLoading || labApiError) return;
    const addr = readSelectedAddress();
    if (!addr?.id.trim()) return;
    if (labApiVendors.length > 0) {
      labEmptySlotsSkipRef.current = false;
      return;
    }
    if (labEmptySlotsSkipRef.current) return;
    labEmptySlotsSkipRef.current = true;
    goLabSlotsWithUnknownVendor({ replace: true });
  }, [
    goLabSlotsWithUnknownVendor,
    isLabTests,
    labApiError,
    labApiLoading,
    labApiVendors.length,
    selectedAddressId,
  ]);

  const hasDeliveryAddress = useHasSelectedDeliveryAddress();

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
          <h1 className="ds-title ds-title--flex">Select Lab</h1>
        </header>

        <main className="ds-main">
          <button
            type="button"
            className="ds-location"
            aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
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
            <AddressStripLabels
              layout="pipe"
              titleClassName="ds-location__title"
              sepClassName="ds-location__sep"
              addrClassName="ds-location__addr"
              promptClassName="ds-location__addr ds-location__addr--prompt"
            />
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
                No lab partner is listed for this address. You can still open time slots — a partner may be
                assigned when you book (or try another address).
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
            disabled={
              labApiLoading ||
              !!labApiError ||
              (labApiVendors.length > 0 && !labSelectedCode)
            }
            onClick={() => {
              if (labApiVendors.length === 0) {
                goLabSlotsWithUnknownVendor({ replace: true });
                return;
              }
              const v = labApiVendors.find((x) => x.code === labSelectedCode);
              try {
                globalThis.localStorage?.setItem("opd-mobile-view.diagnostics.vendorId", labSelectedCode);
                globalThis.localStorage?.setItem("opd-mobile-view.diagnostics.vendorMode", "home");
                globalThis.localStorage?.setItem(DIAG_LAB_VENDOR_CODE_KEY, labSelectedCode);
                globalThis.localStorage?.setItem(DIAG_LAB_VENDOR_NAME_KEY, v?.name ?? "");
              } catch {
                // ignore
              }
              navigate(generatePath(ROUTES.diagnosticsSlots, { type }));
            }}
          >
            {labApiVendors.length === 0 && !labApiLoading && !labApiError
              ? "Continue to time slots"
              : "Continue"}
          </button>
        </footer>
      </div>
      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
      </>
    );
  }

  const formatInr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const renderHealthVendor = (v: HealthSponsoredVendorRow, selected: boolean, onSelect: () => void) => {
    const logoSrc = vendorLogoUrl(v.logo);
    return (
      <button
        key={v.code}
        type="button"
        className={`ds-lab-card ds-lab-card--sel${selected ? " ds-lab-card--selected" : ""}`}
        onClick={onSelect}
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
          <span className={`ds-sellab-check${selected ? " ds-sellab-check--on" : ""}`} aria-hidden="true">
            {selected ? "✓" : ""}
          </span>
        </div>
        <div className="ds-sellab-home">
          <span>{v.category || "Diagnostics"}</span>
        </div>
        <div className="ds-sellab-total">
          <span>From</span>
          <span>₹{formatInr(v.price)}</span>
        </div>
      </button>
    );
  };

  const healthContinueDisabled =
    healthLoading ||
    !healthPricing ||
    (healthPricing.pathologyVendors.length > 1 && !pathVendorCode) ||
    (healthPricing.radiologyVendors.length > 1 && !radVendorCode);

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
          <h1 className="ds-title">Select Vendor</h1>
        </header>

        <main className="ds-main">
          <button
            type="button"
            className="ds-location"
            aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
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
            <AddressStripLabels
              layout="pipe"
              titleClassName="ds-location__title"
              sepClassName="ds-location__sep"
              addrClassName="ds-location__addr"
              promptClassName="ds-location__addr ds-location__addr--prompt"
            />
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

          {healthLoading ? <p className="ds-location__addr">Loading partners…</p> : null}
          {healthError && !healthLoading ? (
            <p className="ds-location__addr" role="alert">
              {healthError}
            </p>
          ) : null}

          {healthPricing?.pathologyCategoryExists ? (
            <section className="ds-health-sec" aria-label="Pathology vendors">
              <div className="ds-health-sec-head">
                <span className="ds-health-sec-head__ic ds-health-sec-head__ic--path" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 3h6v3h-1v4l2 7H8l2-7V6H9V3z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                    <path d="M7 17h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
                <h2 className="ds-health-sec-head__title">Pathology Vendors</h2>
              </div>
              {healthPricing.pathologyVendors.length === 0 ? (
                <p className="ds-location__addr">Partner will be assigned for you.</p>
              ) : (
                <div className="ds-vendors ds-vendors--lab" aria-label="Pathology vendors">
                  {healthPricing.pathologyVendors.map((v) =>
                    renderHealthVendor(v, pathVendorCode === v.code, () => setPathVendorCode(v.code)),
                  )}
                </div>
              )}
            </section>
          ) : null}

          {healthPricing?.radiologyCategoryExists ? (
            <section className="ds-health-sec" aria-label="Radiology vendors">
              <div className="ds-health-sec-head">
                <span className="ds-health-sec-head__ic ds-health-sec-head__ic--rad" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 21a9 9 0 100-18 9 9 0 000 18z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
                    <path d="M12 9v6M9 12h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
                <h2 className="ds-health-sec-head__title">Radiology Vendors</h2>
              </div>
              {healthPricing.radiologyVendors.length === 0 ? (
                <p className="ds-location__addr">Partner will be assigned for you.</p>
              ) : (
                <div className="ds-vendors ds-vendors--lab" aria-label="Radiology vendors">
                  {healthPricing.radiologyVendors.map((v) =>
                    renderHealthVendor(v, radVendorCode === v.code, () => setRadVendorCode(v.code)),
                  )}
                </div>
              )}
            </section>
          ) : null}
        </main>

        <footer className="ds-footer">
          <button
            type="button"
            className="ds-continue"
            disabled={healthContinueDisabled}
            onClick={() => {
              goHealthSlots();
            }}
          >
            Continue to Slots
          </button>
        </footer>
      </div>
      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
    </>
  );
}
