import { ROUTES } from "@/constants";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import {
  clearLabSlotPayload,
  readLabVendorCode,
  writeLabVendorSelection,
} from "@/constants/diagnosticsLabFlowStorage";
import {
  readHealthVendorDraft,
  readHealthVendorMeta,
  writeHealthVendorDraft,
} from "@/constants/diagnosticsHealthFlowStorage";
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
  readHealthSponsoredFlag,
  readHealthUsersPackages,
} from "@/constants/diagnosticsHealthFlowStorage";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import {
  clearHealthSlotSessionBeforeSlots,
  commitHealthVendorSelection,
  resolveHealthVendorCodes,
  writeHealthVendorCategoryMeta,
} from "@/lib/healthCheckupVendorFlow";
import {
  clearHealthVendorStep,
  clearLabVendorAndDownstream,
} from "@/lib/bookingFlowStackCleanup";
import { generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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

export function DiagnosticsScreenPage() {
  const navigate = useNavigate();
  const location = useLocation();
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

  /** Back from vendors → drop vendor/slot storage and in-memory picks (plan data stays on plan screen). */
  const onHealthVendorBack = useCallback(() => {
    clearHealthVendorStep();
    setHealthPricing(null);
    setPathVendorCode(null);
    setRadVendorCode(null);
    setHealthError(null);
    setHealthLoading(false);
    healthAutoSlotsKeyRef.current = null;
  }, []);

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
      const draft = readHealthVendorDraft();
      const meta = readHealthVendorMeta();
      const hasStoredVendorPick =
        Boolean(draft?.pathVendorCode?.trim()) || Boolean(draft?.radVendorCode?.trim());
      const requireUserSelection = !hasStoredVendorPick;
      const { pathVendorCode: pathCode, radVendorCode: radCode } = resolveHealthVendorCodes(res, {
        requireUserSelection,
        preferred: hasStoredVendorPick
          ? {
              pathVendorCode: draft?.pathVendorCode ?? meta?.pathVendorCode,
              radVendorCode: draft?.radVendorCode ?? meta?.radVendorCode,
            }
          : undefined,
      });
      setPathVendorCode(pathCode);
      setRadVendorCode(radCode);
      if (requireUserSelection) {
        writeHealthVendorCategoryMeta(res);
      } else {
        commitHealthVendorSelection(res, { pathVendorCode: pathCode, radVendorCode: radCode });
      }
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
  }, [isLabTests, loadHealthPricing, selectedAddressId, location.key]);

  const goHealthSlots = useCallback(
    (opts?: { replace?: boolean }) => {
      const hp = healthPricing;
      if (!hp) return;
      commitHealthVendorSelection(hp, {
        pathVendorCode: pathVendorCode,
        radVendorCode: radVendorCode,
      });
      clearHealthSlotSessionBeforeSlots();
      const path = generatePath(ROUTES.diagnosticsSlots, { type });
      navigate(path, opts?.replace ? { replace: true } : undefined);
    },
    [healthPricing, pathVendorCode, radVendorCode, navigate, type],
  );

  /** Health (Dart `continueToVendorSelection`): no selectable pathology/radiology vendors → skip vendor UI, open slots. */
  useEffect(() => {
    if (isLabTests) return;
    if (healthLoading || healthError || !healthPricing) return;
    if (healthPricing.hasSelectablePathology || healthPricing.hasSelectableRadiology) return;

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
  const [labSelectedCode, setLabSelectedCode] = useState(() => readLabVendorCode());

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
    labEmptySlotsSkipRef.current = false;
    labVendorFetchSettledRef.current = false;
  }, [isLabTests, selectedAddressId]);

  useEffect(() => {
    if (!isLabTests || labApiVendors.length === 0) return;
    const stored = readLabVendorCode();
    setLabSelectedCode((prev) => {
      const candidate = prev.trim() || stored;
      if (candidate && labApiVendors.some((v) => v.code === candidate)) return candidate;
      return "";
    });
  }, [isLabTests, labApiVendors]);

  /** Lab (Dart `LabSelectionScreen`): no vendors → skip picker and open slots; vendor_code falls back to `unknown` like health slots. */
  const goLabSlotsWithUnknownVendor = useCallback(
    (opts?: { replace?: boolean }) => {
      writeLabVendorSelection("unknown", "");
      clearLabSlotPayload();
      const path = generatePath(ROUTES.diagnosticsSlots, { type });
      navigate(path, opts?.replace ? { replace: true } : undefined);
    },
    [navigate, type],
  );

  const selectLabVendor = useCallback((code: string, displayName: string) => {
    setLabSelectedCode(code);
    writeLabVendorSelection(code, displayName);
  }, []);

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
          <FlowScreenBack
            fallbackTo={generatePath(ROUTES.diagnosticsPlan, { type: "lab-tests" })}
            className="ds-back ds-back--lab"
            ariaLabel="Back"
            onBeforeBack={clearLabVendorAndDownstream}
          />
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
                  onClick={() => selectLabVendor(v.code, v.name)}
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
                      <div className="ds-lab-card__meta">
                        <span className="ds-lab-card__logo ds-lab-card__logo--sel">{v.name}</span>
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
                      </div>
                    </div>
                    <span
                      className={`ds-sellab-check${sel ? " ds-sellab-check--on" : ""}`}
                      aria-hidden="true"
                    >
                      {sel ? "✓" : ""}
                    </span>
                  </div>

                  <div className="ds-sellab-pack">
                    {v.packages.map((p) => (
                      <div key={p.id} className="ds-sellab-line">
                        <span className="ds-sellab-line__name">{p.name}</span>
                        <span className="ds-sellab-line__price">₹{formatInr(p.b2cPrice ?? 0)}</span>
                      </div>
                    ))}
                    <div className="ds-sellab-total">
                      <span>Total</span>
                      <span>₹{formatInr(subtotal)}</span>
                    </div>
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
              writeLabVendorSelection(labSelectedCode, v?.name ?? "");
              clearLabSlotPayload();
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
            <div className="ds-lab-card__meta">
              <span className="ds-lab-card__logo ds-lab-card__logo--sel">{v.name}</span>
              <div className="ds-sellab-home">
                <span>{v.category || "Diagnostics"}</span>
              </div>
            </div>
          </div>
          <span className={`ds-sellab-check${selected ? " ds-sellab-check--on" : ""}`} aria-hidden="true">
            {selected ? "✓" : ""}
          </span>
        </div>
        <div className="ds-sellab-pack ds-sellab-pack--solo">
          <div className="ds-sellab-total">
            <span>From</span>
            <span>₹{formatInr(v.price)}</span>
          </div>
        </div>
      </button>
    );
  };

  const healthContinueDisabled = useMemo(() => {
    if (healthLoading || !healthPricing) return true;
    const hp = healthPricing;
    const needPathPick = hp.hasSelectablePathology && !pathVendorCode?.trim();
    const needRadPick = hp.hasSelectableRadiology && !radVendorCode?.trim();
    return needPathPick || needRadPick;
  }, [healthLoading, healthPricing, pathVendorCode, radVendorCode]);

  return (
    <>
      <div className="ds-page">
        <header className="ds-top">
          <FlowScreenBack
            fallbackTo={generatePath(ROUTES.diagnosticsPlan, { type })}
            className="app-back-btn ds-back"
            ariaLabel="Back"
            onBeforeBack={onHealthVendorBack}
          />
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
          {!healthLoading && !healthPricing && !healthError ? (
            <div className="ds-health-empty">
              <p className="ds-location__addr">No vendors available</p>
              <p className="ds-location__addr ds-location__addr--hint">
                Try changing your address
              </p>
            </div>
          ) : null}
          {healthError && !healthLoading && !healthPricing ? (
            <div className="ds-health-empty" role="alert">
              <p className="ds-location__addr">{healthError}</p>
              <p className="ds-location__addr ds-location__addr--hint">
                Try changing your address
              </p>
            </div>
          ) : null}
          {healthError && !healthLoading && healthPricing ? (
            <p className="ds-location__addr" role="alert">
              {healthError}
            </p>
          ) : null}

          {healthPricing?.hasSelectablePathology ? (
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
              <div className="ds-vendors ds-vendors--lab" aria-label="Pathology vendors">
                {healthPricing.pathologyVendors.map((v) =>
                  renderHealthVendor(v, pathVendorCode === v.code, () => {
                    const next = v.code;
                    const nextRad = radVendorCode;
                    setPathVendorCode(next);
                    commitHealthVendorSelection(healthPricing, {
                      pathVendorCode: next,
                      radVendorCode: nextRad,
                    });
                  }),
                )}
              </div>
            </section>
          ) : null}

          {healthPricing?.hasSelectableRadiology ? (
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
              <div className="ds-vendors ds-vendors--lab" aria-label="Radiology vendors">
                {healthPricing.radiologyVendors.map((v) =>
                  renderHealthVendor(v, radVendorCode === v.code, () => {
                    const next = v.code;
                    const nextPath = pathVendorCode;
                    setRadVendorCode(next);
                    commitHealthVendorSelection(healthPricing, {
                      pathVendorCode: nextPath,
                      radVendorCode: next,
                    });
                  }),
                )}
              </div>
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
