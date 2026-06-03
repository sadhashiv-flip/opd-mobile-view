import { ROUTES } from "@/constants";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import { deliveryAddressChooserAriaLabel } from "@/constants/selectedAddressStorage";
import { useToast } from "@/hooks/useToast";
import { addLabProductToCart, fetchLabCart, removeLabCartItem } from "@/api/patientLabCart";
import {
  fetchDiagnosticPackages,
  fetchDiagnosticsPackageInclusions,
  fetchHealthCheckupPackages,
  fetchSponsoredVendorPricing,
  type DiagnosticCatalogRow,
  type DiagnosticsPackageInclusionGroup,
  type HealthCheckupPackageRow,
} from "@/api/patientDiagnosticsLab";
import {
  readDiagnosticsSelectedMembersSnapshots,
  type DiagnosticsSelectedMemberSnapshot,
} from "@/constants/diagnosticsSelectedMemberStorage";
import {
  readHealthPackageDraft,
  readHealthSponsoredFlag,
  writeHealthPackageDraft,
  writeHealthSponsoredFlag,
  writeHealthUsersPackages,
} from "@/constants/diagnosticsHealthFlowStorage";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { MdClose } from "react-icons/md";
import { clearDiagnosticsDownstreamFromPlan } from "@/lib/bookingFlowStackCleanup";
import {
  clearHealthSlotSessionBeforeSlots,
  commitHealthVendorSelection,
  resolveHealthVendorCodes,
  shouldSkipHealthVendorScreen,
} from "@/lib/healthCheckupVendorFlow";
import { clearHealthVendorStep } from "@/lib/bookingFlowStackCleanup";
import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import Lottie from "lottie-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import chemistryLabLottie from "@/assets/lotties/chemistry_lab.json";
import "./HealthCheckupsPlanPage.css";

function labMetaLine(fastingTime: string, tat: string): string {
  return [fastingTime, tat].map((s) => s.trim()).filter(Boolean).join(" · ");
}

function memberNumericId(m: DiagnosticsSelectedMemberSnapshot): number | null {
  if (typeof m.userId === "number" && Number.isFinite(m.userId) && m.userId > 0) return m.userId;
  const n = Number(m.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function capitalizeCategoryWord(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return `${t[0].toUpperCase()}${t.slice(1).toLowerCase()}`;
}

/**
 * Single package per member — matches patient_app `HealthCheckupsController.togglePackageForMember`
 * (tap same package clears; tap another replaces).
 */
function toggleHealthPackageForMemberSingle(
  prev: Record<string, number[]>,
  memberId: string,
  packageId: number,
): Record<string, number[]> {
  const cur = prev[memberId] ?? [];
  if (cur.includes(packageId)) {
    return { ...prev, [memberId]: [] };
  }
  return { ...prev, [memberId]: [packageId] };
}

/** patient_app `SelectPlanPage._PackageCard`: `assets/lotties/chemistry_lab.json` 48×48 only (no API image in Flutter). */
const PACKAGE_LEAD_LOTTIE = (
  <span className="hcp-pkg-card__lottie48" aria-hidden>
    <Lottie animationData={chemistryLabLottie} loop style={{ width: 48, height: 48 }} />
  </span>
);

const HCP_IC_DINING = (
  <svg className="hcp-info-chip__ic" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 3v18M8 3v6M8 15v6M13 3v18M18 8v8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const HCP_IC_SCHEDULE = (
  <svg className="hcp-info-chip__ic" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function HealthCheckupsPlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const toast = useToast();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const pageTitle = type === "lab-tests" ? "Lab Tests" : "Select Package";
  const healthMembers = readDiagnosticsSelectedMembersSnapshots();
  const [activeMemberIdx, setActiveMemberIdx] = useState(0);
  const [healthPkgs, setHealthPkgs] = useState<readonly HealthCheckupPackageRow[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [pkgByMemberKey, setPkgByMemberKey] = useState<Record<string, number[]>>(() =>
    type === "health-checkups" ? readHealthPackageDraft() : {},
  );
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hasDeliveryAddress = useHasSelectedDeliveryAddress();
  const selectedAddressId = useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.id?.trim() ?? "",
    () => "",
  );

  const [labQuery, setLabQuery] = useState("");
  const [labPackages, setLabPackages] = useState<readonly DiagnosticCatalogRow[]>([]);
  const [labListLoading, setLabListLoading] = useState(false);
  const [labListError, setLabListError] = useState<string | null>(null);
  const [labCartCount, setLabCartCount] = useState(0);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [inCartProductIds, setInCartProductIds] = useState<ReadonlySet<number>>(() => new Set());
  const [labCartByProductId, setLabCartByProductId] = useState(() => new Map<number, number>());

  const [inclusionsPricingId, setInclusionsPricingId] = useState<number | null>(null);
  const [inclusionsLoading, setInclusionsLoading] = useState(false);
  const [inclusionsGroups, setInclusionsGroups] = useState<readonly DiagnosticsPackageInclusionGroup[]>([]);
  const [inclusionsErr, setInclusionsErr] = useState<string | null>(null);
  /** patient_app `HealthCheckupsController.isVendorLoading` on plan Continue. */
  const [vendorContinueLoading, setVendorContinueLoading] = useState(false);

  const openPackageInclusions = useCallback(async (pricingId: number) => {
    setInclusionsPricingId(pricingId);
    setInclusionsLoading(true);
    setInclusionsErr(null);
    setInclusionsGroups([]);
    try {
      const g = await fetchDiagnosticsPackageInclusions(pricingId);
      setInclusionsGroups(g);
    } catch (e) {
      setInclusionsErr(e instanceof Error ? e.message : "Could not load inclusions");
    } finally {
      setInclusionsLoading(false);
    }
  }, []);

  const refreshLabCart = useCallback(async () => {
    try {
      const snap = await fetchLabCart();
      setLabCartCount(snap.items.length);
      setInCartProductIds(new Set(snap.items.map((i) => i.productId)));
      const map = new Map<number, number>();
      for (const it of snap.items) map.set(it.productId, it.id);
      setLabCartByProductId(map);
    } catch {
      setLabCartCount(0);
      setInCartProductIds(new Set());
      setLabCartByProductId(new Map());
    }
  }, []);

  useEffect(() => {
    setLabPackages([]);
    setLabQuery("");
    setLabCartCount(0);
    setInCartProductIds(new Set());
    setPkgByMemberKey(type === "health-checkups" ? readHealthPackageDraft() : {});
    setActiveMemberIdx(0);
    setHealthPkgs([]);
    setHealthErr(null);
  }, [type]);

  useEffect(() => {
    if (type !== "health-checkups") return;
    writeHealthPackageDraft(pkgByMemberKey);
  }, [type, pkgByMemberKey]);

  /** URL can only promote sponsored — never force `false` (would wipe member-based flag set on Continue). */
  useEffect(() => {
    if (type !== "health-checkups") return;
    const sp = new URLSearchParams(location.search);
    if (sp.get("sponsored") === "1" || sp.get("ahc") === "1") {
      writeHealthSponsoredFlag(true);
    }
  }, [type, location.search]);

  const activeHealthMember = healthMembers[activeMemberIdx] ?? null;
  const packagesCacheRef = useRef(new Map<string, readonly HealthCheckupPackageRow[]>());

  useEffect(() => {
    if (activeMemberIdx >= healthMembers.length) setActiveMemberIdx(0);
  }, [activeMemberIdx, healthMembers.length]);

  useEffect(() => {
    if (type !== "health-checkups" || !activeHealthMember) return;
    const memberKey = activeHealthMember.id;
    const cached = packagesCacheRef.current.get(memberKey);
    if (cached) {
      setHealthPkgs(cached);
      setHealthErr(null);
      setHealthLoading(false);
      return;
    }
    const uid = memberNumericId(activeHealthMember);
    if (uid == null) {
      setHealthErr("Missing patient id for this member. Go back and pick someone from your profile list.");
      setHealthPkgs([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setHealthLoading(true);
      setHealthErr(null);
      try {
        const rows = await fetchHealthCheckupPackages({
          userId: uid,
          sponsored: readHealthSponsoredFlag(),
        });
        if (!cancelled) {
          packagesCacheRef.current.set(memberKey, rows);
          setHealthPkgs(rows);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load packages";
          setHealthErr(msg);
          setHealthPkgs([]);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, activeHealthMember?.id, activeMemberIdx, toast, location.key, location.search]);

  useEffect(() => {
    if (type !== "lab-tests") return;
    void refreshLabCart();
  }, [type, refreshLabCart, selectedAddressId]);

  useEffect(() => {
    if (type !== "lab-tests") return;
    const addr = readSelectedAddress();
    if (!addr?.id.trim()) {
      setLabPackages([]);
      setLabListError("Choose a saved address to search lab tests.");
      return;
    }
    let cancelled = false;
    const q = labQuery.trim();
    const handle = window.setTimeout(() => {
      void (async () => {
        setLabListLoading(true);
        setLabListError(null);
        try {
          const rows = await fetchDiagnosticPackages({
            loc: addr.id.trim(),
            name: q || undefined,
            page: 1,
            limit: 20,
          });
          if (!cancelled) setLabPackages(rows);
        } catch (e) {
          if (!cancelled) {
            const msg = e instanceof Error ? e.message : "Could not load tests";
            setLabListError(msg);
            setLabPackages([]);
            toast.error(msg);
          }
        } finally {
          if (!cancelled) setLabListLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [type, labQuery, selectedAddressId, toast]);

  /**
   * patient_app `continueToVendorSelection`: load sponsored pricing first;
   * when pathology/radiology only return `unknown`, go straight to slots (no vendor screen flash).
   */
  const continueHealthAfterPackages = useCallback(async () => {
    if (healthMembers.length === 0) {
      toast.error("Select at least one person for this booking.");
      return;
    }
    const rows: { user_id: number; packages: number[] }[] = [];
    for (const m of healthMembers) {
      const uid = memberNumericId(m);
      const pids = pkgByMemberKey[m.id] ?? [];
      if (uid == null || pids.length === 0) {
        toast.error("Please select a package for each member");
        return;
      }
      rows.push({ user_id: uid, packages: [...pids] });
    }
    writeHealthUsersPackages(rows);

    const addr = readSelectedAddress();
    if (!addr?.id.trim()) {
      toast.error("Please select an address");
      return;
    }

    setVendorContinueLoading(true);
    try {
      /** Fresh vendor step when leaving plan (matches Dart `fetchVendorPricing` clearing selections). */
      clearHealthVendorStep();

      const pricing = await fetchSponsoredVendorPricing({
        addressId: addr.id.trim(),
        sponsored: readHealthSponsoredFlag(),
        users: rows,
      });

      if (shouldSkipHealthVendorScreen(pricing)) {
        const codes = resolveHealthVendorCodes(pricing);
        commitHealthVendorSelection(pricing, codes);
        clearHealthSlotSessionBeforeSlots();
        navigate(generatePath(ROUTES.diagnosticsSlots, { type }));
        return;
      }

      /** Vendor screen loads pricing and applies picks — do not restore stale draft from a prior visit. */
      navigate(generatePath(ROUTES.diagnosticsVendors, { type }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load partners";
      toast.error(msg);
    } finally {
      setVendorContinueLoading(false);
    }
  }, [healthMembers, pkgByMemberKey, navigate, toast, type]);

  const memberHasPackages = (memberKey: string) => (pkgByMemberKey[memberKey]?.length ?? 0) > 0;

  const activeMemberHasPackage =
    activeHealthMember != null && memberHasPackages(activeHealthMember.id);
  const allMembersHavePackage =
    healthMembers.length > 0 && healthMembers.every((m) => memberHasPackages(m.id));
  const nextMemberNeedingPackage =
    healthMembers.find((m) => !memberHasPackages(m.id)) ?? null;

  const healthPrimaryCtaLabel = (() => {
    if (!activeMemberHasPackage) return "Continue";
    if (allMembersHavePackage) return "Continue";
    const next = nextMemberNeedingPackage;
    if (!next) return "Continue";
    const name = next.name.trim() || "member";
    const combined = `Select package for ${name}`;
    return combined.length > 42 ? "Continue for next member" : combined;
  })();

  const onHealthPrimaryFooterTap = () => {
    if (!activeMemberHasPackage || healthLoading || vendorContinueLoading) return;
    if (allMembersHavePackage) {
      void continueHealthAfterPackages();
      return;
    }
    const idx = healthMembers.findIndex((m) => !memberHasPackages(m.id));
    if (idx >= 0) setActiveMemberIdx(idx);
  };

  const toggleLabCartRow = async (productId: number, checked: boolean) => {
    if (addingProductId != null) return;
    const addr = readSelectedAddress();
    if (!addr?.id.trim()) {
      toast.error("Choose a saved address first");
      return;
    }
    setAddingProductId(productId);
    try {
      if (checked) {
        await addLabProductToCart(productId);
      } else {
        const cartItemId = labCartByProductId.get(productId);
        if (cartItemId != null) await removeLabCartItem(cartItemId);
      }
      await refreshLabCart();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update cart");
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <div
      className={`hcp-page${type === "health-checkups" ? " hcp-page--health-plan-viewport" : ""}`}
    >
      <header className="hcp-top">
        <FlowScreenBack
          fallbackTo={generatePath(ROUTES.diagnosticsSelectPeople, { type })}
          className="app-back-btn hcp-back"
          ariaLabel={`Back to ${type === "lab-tests" ? "diagnostics" : "Health Checkups"}`}
          onBeforeBack={() => clearDiagnosticsDownstreamFromPlan(type)}
        />
        <h1 className="hcp-title">{pageTitle}</h1>
        <span className="hcp-top__spacer" aria-hidden />
      </header>

      <main className={`hcp-main${type === "health-checkups" ? " hcp-main--health-plan" : ""}`}>
        {type === "lab-tests" ? (
          <>
            <button
              type="button"
              className="hcp-loc"
              aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
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
              <AddressStripLabels
                layout="pipe"
                titleClassName="hcp-loc__title"
                sepClassName="hcp-loc__sep"
                addrClassName="hcp-loc__addr"
                promptClassName="hcp-loc__addr hcp-loc__addr--prompt"
              />
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
          </>
        ) : null}

        {type === "lab-tests" ? (
          <div className="lt-wrap">
            <div className="lt-search lt-search--simple" role="search">
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
                placeholder="Search lab tests…"
                value={labQuery}
                onChange={(e) => setLabQuery(e.target.value)}
                aria-label="Search lab tests"
              />
            </div>

            <section className="lt-section lt-section--list" aria-label="Lab tests">
              {labListError && !labListLoading ? (
                <p className="lt-section__sub" role="alert">
                  {labListError}
                </p>
              ) : null}
              {labListLoading ? <p className="lt-section__sub">Loading tests…</p> : null}

              <ul className="lt-list" aria-busy={labListLoading}>
                {labPackages.map((t) => {
                  const inCart = inCartProductIds.has(t.id);
                  const busy = addingProductId === t.id;
                  return (
                    <li key={t.id} className="lt-row">
                      <span className="lt-row__ic" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M10 3h4v2h-1v5l2 8H9l2-8V5H10V3z"
                            fill="#c5c5c5"
                          />
                        </svg>
                      </span>
                      <div className="lt-row__body">
                        <div className="lt-row__title">{t.name}</div>
                        {labMetaLine(t.fastingTime, t.tat) ? (
                          <div className="lt-row__meta">{labMetaLine(t.fastingTime, t.tat)}</div>
                        ) : null}
                      </div>
                      <label className="lt-row__cb-wrap">
                        <input
                          type="checkbox"
                          className="lt-row__cb"
                          checked={inCart}
                          disabled={busy}
                          onChange={(e) => void toggleLabCartRow(t.id, e.target.checked)}
                          aria-label={inCart ? `Remove ${t.name} from cart` : `Add ${t.name} to cart`}
                        />
                        <span className="lt-row__cb-ui" aria-hidden="true" />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            {labCartCount > 0 ? (
              <footer className="lt-cart-footer" aria-label="Cart">
                <div className="lt-cart-footer__inner">
                  <div className="lt-cart-footer__left">
                    {labCartCount} {labCartCount === 1 ? "test" : "tests"}
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
          <div className="hcp-health-plan" aria-label="Health packages">
            {healthMembers.length === 0 ? (
              <div className="hcp-empty">
                <p className="lt-section__sub">Select who the checkup is for, then choose a package.</p>
                <Link className="hcp-empty__link" to={generatePath(ROUTES.diagnosticsSelectPeople, { type })}>
                  Choose people
                </Link>
              </div>
            ) : (
              <>
                <div className="hcp-plans-scroll">
                  {healthErr && !healthLoading ? (
                    <p className="hcp-plan-err" role="alert">
                      {healthErr}
                    </p>
                  ) : null}

                  {healthLoading ? (
                    <div className="hcp-plan-loading">
                      <output className="hcp-plan-loading__spinner" aria-live="polite">
                        Loading
                      </output>
                    </div>
                  ) : activeHealthMember && healthPkgs.length === 0 && !healthErr ? (
                    <div className="hcp-plan-empty">
                      <div className="hcp-plan-empty__lottie" aria-hidden>
                        <Lottie animationData={chemistryLabLottie} loop style={{ width: 180, height: 180 }} />
                      </div>
                      <p className="hcp-plan-empty__msg">No packages available</p>
                    </div>
                  ) : activeHealthMember ? (
                    <div className="hcp-plan-stack" role="list" aria-label="Packages">
                      {healthPkgs.map((pkg) => {
                        const sel = (pkgByMemberKey[activeHealthMember.id] ?? []).includes(pkg.id);
                        const catLower = pkg.category.trim().toLowerCase();
                        const catChipClass =
                          catLower === "pathology"
                            ? "hcp-cat-chip--pathology"
                            : catLower === "radiology"
                              ? "hcp-cat-chip--radiology"
                              : "hcp-cat-chip--default";
                        return (
                          <div key={pkg.id} className={`hcp-pkg-card${sel ? " hcp-pkg-card--selected" : ""}`} role="listitem">
                            <button
                              type="button"
                              className="hcp-pkg-card__tap"
                              aria-pressed={sel}
                              onClick={() =>
                                setPkgByMemberKey((prev) =>
                                  toggleHealthPackageForMemberSingle(prev, activeHealthMember.id, pkg.id),
                                )
                              }
                            >
                              <span className="hcp-pkg-card__icon-wrap">{PACKAGE_LEAD_LOTTIE}</span>
                              <div className="hcp-pkg-card__body">
                                <h2 className="hcp-pkg-card__title">{pkg.name}</h2>
                                <div className="hcp-pkg-card__chips">
                                  {pkg.fastingTime.trim() ? (
                                    <span className="hcp-info-chip">
                                      {HCP_IC_DINING}
                                      <span className="hcp-info-chip__text">{pkg.fastingTime.trim()}</span>
                                    </span>
                                  ) : null}
                                  {pkg.tat.trim() ? (
                                    <span className="hcp-info-chip">
                                      {HCP_IC_SCHEDULE}
                                      <span className="hcp-info-chip__text">{pkg.tat.trim()}</span>
                                    </span>
                                  ) : null}
                                  {catLower === "group" ? (
                                    <>
                                      <span className="hcp-cat-chip hcp-cat-chip--pathology">Pathology</span>
                                      <span className="hcp-cat-chip hcp-cat-chip--radiology">Radiology</span>
                                    </>
                                  ) : (
                                    <span className={`hcp-cat-chip ${catChipClass}`}>
                                      {capitalizeCategoryWord(pkg.category)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="hcp-pkg-card__radio-slot" aria-hidden>
                                <span className={`hcp-pkg-card__radio${sel ? " hcp-pkg-card__radio--on" : ""}`}>
                                  {sel ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                      <path
                                        d="M20 6L9 17l-5-5"
                                        stroke="#ffffff"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  ) : null}
                                </span>
                              </span>
                            </button>
                            {pkg.pricingId != null ? (
                              <button
                                type="button"
                                className="hcp-inclusions-link"
                                onClick={() => void openPackageInclusions(pkg.pricingId!)}
                              >
                                <span>See what&apos;s included</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path
                                    d="M9 6l6 6-6 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {type === "lab-tests" ? null : (
        <footer className="hcp-footer">
          <button
            type="button"
            className="hcp-continue"
            disabled={
              healthMembers.length === 0 ||
              healthLoading ||
              vendorContinueLoading ||
              !activeMemberHasPackage
            }
            aria-busy={vendorContinueLoading}
            onClick={onHealthPrimaryFooterTap}
          >
            {vendorContinueLoading ? "Loading…" : healthPrimaryCtaLabel}
          </button>
        </footer>
      )}

      {inclusionsPricingId != null ? (
        <div
          className="hcp-incl-overlay"
          role="presentation"
          onClick={() => {
            setInclusionsPricingId(null);
            setInclusionsErr(null);
            setInclusionsGroups([]);
          }}
        >
          <div
            className="hcp-incl-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hcp-incl-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="hcp-incl-head">
              <h2 id="hcp-incl-title">What&apos;s included</h2>
              <button
                type="button"
                className="hcp-incl-close"
                aria-label="Close"
                onClick={() => {
                  setInclusionsPricingId(null);
                  setInclusionsErr(null);
                  setInclusionsGroups([]);
                }}
              >
                <MdClose size={22} aria-hidden />
              </button>
            </header>
            <div className="hcp-incl-body">
              {inclusionsLoading ? <p className="hcp-incl-status">Loading…</p> : null}
              {inclusionsErr ? (
                <p className="hcp-incl-status hcp-incl-status--err" role="alert">
                  {inclusionsErr}
                </p>
              ) : null}
              {!inclusionsLoading && !inclusionsErr && inclusionsGroups.length === 0 ? (
                <p className="hcp-incl-status">No inclusion details for this package.</p>
              ) : null}
              <ul className="hcp-incl-list">
                {inclusionsGroups.map((g, gi) => (
                  <li key={`${g.name}-${gi}`} className="hcp-incl-block">
                    <h3 className="hcp-incl-block__title">{g.name}</h3>
                    {g.lines.length === 0 ? null : (
                      <ul className="hcp-incl-lines">
                        {g.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

