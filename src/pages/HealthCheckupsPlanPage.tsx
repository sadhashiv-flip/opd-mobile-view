import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  readSelectedAddress,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";
import { useSelectedAddressLine, useSelectedAddressTag } from "@/hooks/useSelectedAddressLine";
import { useToast } from "@/hooks/useToast";
import { addLabProductToCart, fetchLabCart, removeLabCartItem } from "@/api/patientLabCart";
import {
  fetchDiagnosticPackages,
  fetchHealthCheckupPackages,
  type DiagnosticCatalogRow,
  type HealthCheckupPackageRow,
} from "@/api/patientDiagnosticsLab";
import {
  readDiagnosticsSelectedMembersSnapshots,
  type DiagnosticsSelectedMemberSnapshot,
} from "@/constants/diagnosticsSelectedMemberStorage";
import {
  readHealthSponsoredFlag,
  writeHealthSponsoredFlag,
  writeHealthUsersPackages,
} from "@/constants/diagnosticsHealthFlowStorage";
import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import "./HealthCheckupsPlanPage.css";

function labFastingLabel(hours: number | null): string {
  if (hours != null && hours > 0) return `${hours} hrs Fasting Required`;
  return "Fasting not required";
}

function labReportsLabel(tat: number | null): string {
  if (tat == null) return "Reports time on confirm";
  const days = Math.max(1, Math.round(tat / 24));
  if (days === 1) return "Reports in 1 day";
  return `Reports in ${days} days`;
}

function memberNumericId(m: DiagnosticsSelectedMemberSnapshot): number | null {
  if (typeof m.userId === "number" && Number.isFinite(m.userId) && m.userId > 0) return m.userId;
  const n = Number(m.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function HealthCheckupsPlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const toast = useToast();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const pageTitle = type === "lab-tests" ? "Lab Tests" : "Health Checkups";
  const healthMembers = readDiagnosticsSelectedMembersSnapshots();
  const [activeMemberIdx, setActiveMemberIdx] = useState(0);
  const [healthPkgs, setHealthPkgs] = useState<readonly HealthCheckupPackageRow[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [pkgByMemberKey, setPkgByMemberKey] = useState<Record<string, number>>({});
  const [healthPage, setHealthPage] = useState(1);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hcpLocAddrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);
  const hcpLocTag = useSelectedAddressTag("HOME");
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
    setPkgByMemberKey({});
    setActiveMemberIdx(0);
    setHealthPkgs([]);
    setHealthErr(null);
    setHealthPage(1);
  }, [type]);

  useEffect(() => {
    if (type !== "health-checkups") return;
    const sp = new URLSearchParams(location.search);
    writeHealthSponsoredFlag(sp.get("sponsored") === "1" || sp.get("ahc") === "1");
  }, [type, location.search]);

  const activeHealthMember = healthMembers[activeMemberIdx] ?? null;

  useEffect(() => {
    if (activeMemberIdx >= healthMembers.length) setActiveMemberIdx(0);
  }, [activeMemberIdx, healthMembers.length]);

  useEffect(() => {
    if (type !== "health-checkups" || !activeHealthMember) return;
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
        if (!cancelled) setHealthPkgs(rows);
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
  }, [type, activeHealthMember?.id, activeMemberIdx, toast]);

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

  const healthPageSize = 2;
  const healthPageCount = Math.max(1, Math.ceil(healthPkgs.length / healthPageSize));
  const visibleHealthPkgs = useMemo(() => {
    const start = (healthPage - 1) * healthPageSize;
    return healthPkgs.slice(start, start + healthPageSize);
  }, [healthPage, healthPkgs]);

  const continueHealthToVendors = () => {
    if (healthMembers.length === 0) {
      toast.error("Select at least one person for this booking.");
      return;
    }
    const rows: { user_id: number; packages: number[] }[] = [];
    for (const m of healthMembers) {
      const uid = memberNumericId(m);
      const pid = pkgByMemberKey[m.id];
      if (uid == null || pid == null) {
        toast.error("Choose a package for each selected person.");
        return;
      }
      rows.push({ user_id: uid, packages: [pid] });
    }
    writeHealthUsersPackages(rows);
    navigate(generatePath(ROUTES.diagnosticsVendors, { type }));
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
          <span className="hcp-loc__title">{hcpLocTag}</span>
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
                        <div className="lt-row__meta">
                          {labFastingLabel(t.fastingTime)} · {labReportsLabel(t.tat)}
                        </div>
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
          <div className="hcp-plans hcp-plans--api" aria-label="Health packages">
            {healthMembers.length === 0 ? (
              <div className="hcp-empty">
                <p className="lt-section__sub">Select who the checkup is for, then choose a package.</p>
                <Link className="hcp-empty__link" to={generatePath(ROUTES.diagnosticsSelectPeople, { type })}>
                  Choose people
                </Link>
              </div>
            ) : (
              <>
                {healthMembers.length > 1 ? (
                  <div className="hcp-member-tabs" role="tablist" aria-label="Member">
                    {healthMembers.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        role="tab"
                        className={`hcp-member-tab${i === activeMemberIdx ? " hcp-member-tab--active" : ""}`}
                        aria-selected={i === activeMemberIdx}
                        onClick={() => {
                          setActiveMemberIdx(i);
                          setHealthPage(1);
                        }}
                      >
                        {m.name.trim() || "Member"}
                      </button>
                    ))}
                  </div>
                ) : null}

                {healthErr && !healthLoading ? (
                  <p className="lt-section__sub" role="alert">
                    {healthErr}
                  </p>
                ) : null}
                {healthLoading ? <p className="lt-section__sub">Loading packages…</p> : null}

                <div className="hcp-plans__head">
                  <div className="hcp-plans__title">Packages</div>
                  <div className="hcp-plans__pager" aria-label="Package pagination">
                    <button
                      type="button"
                      className="hcp-pagebtn"
                      onClick={() => setHealthPage((p) => Math.max(1, p - 1))}
                      disabled={healthPage <= 1}
                    >
                      Prev
                    </button>
                    <span className="hcp-pagecount">
                      {healthPage}/{healthPageCount}
                    </span>
                    <button
                      type="button"
                      className="hcp-pagebtn"
                      onClick={() => setHealthPage((p) => Math.min(healthPageCount, p + 1))}
                      disabled={healthPage >= healthPageCount}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="hcp-plan-stack" role="radiogroup" aria-label="Select package for this person">
                  {activeHealthMember
                    ? visibleHealthPkgs.map((pkg) => {
                        const sel = pkgByMemberKey[activeHealthMember.id] === pkg.id;
                        const fasting =
                          pkg.fastingTime != null && pkg.fastingTime > 0
                            ? `${pkg.fastingTime} hrs fasting`
                            : "No fasting required";
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            className={`hcp-card hcp-card--interactive${sel ? " hcp-card--selected" : ""}`}
                            aria-pressed={sel}
                            onClick={() =>
                              setPkgByMemberKey((prev) => ({
                                ...prev,
                                [activeHealthMember.id]: pkg.id,
                              }))
                            }
                          >
                            <div className="hcp-card__top">
                              <h2 className="hcp-card__name">{pkg.name}</h2>
                              <span className="hcp-pill">{pkg.category}</span>
                            </div>
                            <div className="hcp-warn">
                              <span className="hcp-warn__ic" aria-hidden="true">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                                  <path d="M12 7v6" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </span>
                              <span className="hcp-warn__text">{fasting}</span>
                            </div>
                            <ul className="hcp-list">
                              <li className="hcp-li">
                                <span className="hcp-li__ic" aria-hidden="true">
                                  ✓
                                </span>
                                {labReportsLabel(pkg.tat)}
                              </li>
                              <li className="hcp-li">
                                <span className="hcp-li__ic" aria-hidden="true">
                                  ✓
                                </span>
                                Home sample collection where available
                              </li>
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
                              Health checkup
                            </div>
                          </button>
                        );
                      })
                    : null}
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
              healthMembers.some((m) => pkgByMemberKey[m.id] == null) ||
              healthLoading
            }
            onClick={continueHealthToVendors}
          >
            Continue
          </button>
        </footer>
      )}
    </div>
  );
}

