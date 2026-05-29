import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchGymEligibility,
  fetchGymPackages,
  type GymDependentPackage,
  type GymEligibilityData,
  type GymEmployeePackage,
  type GymSubscriptionRow,
} from "@/api/patientGymSubscription";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { ROUTES } from "@/constants";
import {
  writeGymFlowV2Draft,
  writeGymFlowV2LineForms,
  clearGymFlowV2Overview,
  clearGymFlowV2LineForms,
} from "@/constants/gymFlowV2Storage";
import {
  buildLineForms,
  canProceedFromSelections,
  dependentCandidates,
  employeeMemberRow,
  gymDependentMemberEligibleForApply,
  gymDependentPickerRowUi,
  memberCanBuyGym,
  memberGymEligibilityBlockMessage,
  parseMemberId,
} from "@/lib/gymSubscriptionFlow";
import { SubscriptionActivateCtaButton } from "@/components/select-people/SubscriptionActivateCtaButton";
import { portalToMobileFrame } from "@/lib/mobileFramePortal";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { useToast } from "@/hooks/useToast";
import "./GymMembershipPage.css";
import "./HealthCheckupsOverviewPage.css";

function InfoBanner({ text, warning }: Readonly<{ text: string; warning: boolean }>) {
  return (
    <div className={`gym-sub-banner${warning ? " gym-sub-banner--warn" : " gym-sub-banner--info"}`}>
      <span className="gym-sub-banner__icon" aria-hidden>
        ⓘ
      </span>
      <p className="gym-sub-banner__text">{text}</p>
    </div>
  );
}

export function GymMembershipPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [packagesRows, setPackagesRows] = useState<GymSubscriptionRow[]>([]);
  const [selectedSubscriptionIndex, setSelectedSubscriptionIndex] = useState(0);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityData, setEligibilityData] = useState<GymEligibilityData | null>(null);
  const [eligibilityFetchFailed, setEligibilityFetchFailed] = useState(false);
  const [familyRows, setFamilyRows] = useState<GymMemberListRow[]>([]);
  const [selectedEmployeePackageCodes, setSelectedEmployeePackageCodes] = useState<string[]>([]);
  const [selectedDependentPackageCodes, setSelectedDependentPackageCodes] = useState<string[]>([]);
  const [dependentMemberIdsByPackage, setDependentMemberIdsByPackage] = useState<
    Record<string, string[]>
  >({});
  const [depModalPkg, setDepModalPkg] = useState<GymDependentPackage | null>(null);

  const activeSubscription = useMemo(() => {
    const rows = packagesRows;
    const i = selectedSubscriptionIndex;
    if (!rows.length || i < 0 || i >= rows.length) return null;
    return rows[i];
  }, [packagesRows, selectedSubscriptionIndex]);

  const eligibilityReady = useMemo(() => {
    const sub = activeSubscription;
    const ed = eligibilityData;
    if (!sub) return true;
    if (eligibilityLoading) return false;
    if (eligibilityFetchFailed) return false;
    return ed != null && ed.subscriptionId === sub.subscriptionId;
  }, [activeSubscription, eligibilityData, eligibilityLoading, eligibilityFetchFailed]);

  const employeeRow = useMemo(() => employeeMemberRow(familyRows), [familyRows]);
  const empMid = employeeRow ? parseMemberId(employeeRow) : 0;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, members] = await Promise.all([
        fetchGymPackages(),
        Promise.all([fetchAllPatientMembers(), fetchAnySubscriptionCanActivate()]).then(([list, canAct]) =>
          patientMembersToGymRows(list, { subscriptionCanActivate: canAct }),
        ),
      ]);
      setPackagesRows([...pkgs]);
      setFamilyRows(members);
      clearGymFlowV2Overview();
      clearGymFlowV2LineForms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load gym packages");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const sub = activeSubscription;
    if (!sub) {
      setEligibilityData(null);
      return;
    }
    let cancelled = false;
    setEligibilityFetchFailed(false);
    setEligibilityLoading(true);
    setEligibilityData(null);
    void (async () => {
      try {
        const ed = await fetchGymEligibility(sub.subscriptionId);
        if (!cancelled) setEligibilityData(ed);
      } catch (e) {
        if (!cancelled) {
          setEligibilityFetchFailed(true);
          toast.error(e instanceof Error ? e.message : "Gym eligibility failed");
        }
      } finally {
        if (!cancelled) setEligibilityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSubscription?.subscriptionId, toast]);

  /** Prune selections when eligibility changes — mirrors Dart `_pruneSelectionsAgainstEligibility`. */
  useEffect(() => {
    const ed = eligibilityData;
    if (!ed) return;
    if (!employeeRow || !memberCanBuyGym(ed, empMid)) {
      setSelectedEmployeePackageCodes([]);
    }
    setDependentMemberIdsByPackage((prev) => {
      const next = { ...prev };
      for (const code of Object.keys(next)) {
        const kept = (next[code] ?? []).filter((id) => {
          const row = familyRows.find((r) => r.id === id);
          return row ? gymDependentMemberEligibleForApply(ed, row) : false;
        });
        if (kept.length === 0) {
          delete next[code];
          setSelectedDependentPackageCodes((c) => c.filter((x) => x !== code));
        } else {
          next[code] = kept;
        }
      }
      return next;
    });
  }, [eligibilityData, employeeRow, empMid, familyRows]);

  const selectSubscription = useCallback((index: number) => {
    setSelectedSubscriptionIndex(index);
    setSelectedEmployeePackageCodes([]);
    setSelectedDependentPackageCodes([]);
    setDependentMemberIdsByPackage({});
    clearGymFlowV2LineForms();
  }, []);

  const toggleEmployeePackage = useCallback(
    (code: string) => {
      setSelectedEmployeePackageCodes((prev) => {
        if (prev.includes(code)) {
          return prev.filter((c) => c !== code);
        }
        if (eligibilityLoading) {
          toast.error("Checking eligibility…");
          return prev;
        }
        if (!eligibilityReady) {
          toast.error("Could not verify eligibility. Try again.");
          return prev;
        }
        if (!employeeRow || !memberCanBuyGym(eligibilityData, empMid)) {
          const msg =
            employeeRow != null
              ? memberGymEligibilityBlockMessage(eligibilityData, empMid)
              : null;
          toast.error(msg ?? "Employee is not eligible for gym purchase.");
          return prev;
        }
        return [...prev, code];
      });
    },
    [
      eligibilityLoading,
      eligibilityReady,
      eligibilityData,
      employeeRow,
      empMid,
      toast,
    ],
  );

  const applyDependentSelection = useCallback(
    (packageCode: string, memberIds: string[]) => {
      const ed = eligibilityData;
      const filtered = memberIds.filter((id) => {
        const row = familyRows.find((r) => r.id === id);
        return row != null && ed != null && gymDependentMemberEligibleForApply(ed, row);
      });
      const uniq = [...new Set(filtered)];
      if (uniq.length === 0) {
        setSelectedDependentPackageCodes((c) => c.filter((x) => x !== packageCode));
        setDependentMemberIdsByPackage((m) => {
          const { [packageCode]: _, ...rest } = m;
          return rest;
        });
      } else {
        setSelectedDependentPackageCodes((c) =>
          c.includes(packageCode) ? c : [...c, packageCode],
        );
        setDependentMemberIdsByPackage((m) => ({ ...m, [packageCode]: uniq }));
      }
    },
    [eligibilityData, familyRows],
  );

  const isDependentSelectedInOtherPackage = useCallback(
    (packageCode: string, memberId: string) => {
      for (const [code, ids] of Object.entries(dependentMemberIdsByPackage)) {
        if (code === packageCode) continue;
        if (ids.includes(memberId)) return true;
      }
      return false;
    },
    [dependentMemberIdsByPackage],
  );

  const canProceed = useMemo(
    () =>
      canProceedFromSelections(
        eligibilityData,
        eligibilityLoading,
        eligibilityFetchFailed,
        activeSubscription,
        selectedEmployeePackageCodes,
        selectedDependentPackageCodes,
        dependentMemberIdsByPackage,
        familyRows,
      ),
    [
      eligibilityData,
      eligibilityLoading,
      eligibilityFetchFailed,
      activeSubscription,
      selectedEmployeePackageCodes,
      selectedDependentPackageCodes,
      dependentMemberIdsByPackage,
      familyRows,
    ],
  );

  const onContinue = useCallback(() => {
    if (!activeSubscription || !canProceed) return;
    const forms = buildLineForms(
      activeSubscription,
      familyRows,
      selectedEmployeePackageCodes,
      selectedDependentPackageCodes,
      dependentMemberIdsByPackage,
    );
    writeGymFlowV2Draft({
      selectedSubscriptionIndex,
      selectedEmployeePackageCodes,
      selectedDependentPackageCodes,
      dependentMemberIdsByPackage,
    });
    writeGymFlowV2LineForms(forms);
    navigate(ROUTES.gymMembershipContact);
  }, [
    activeSubscription,
    canProceed,
    familyRows,
    selectedEmployeePackageCodes,
    selectedDependentPackageCodes,
    dependentMemberIdsByPackage,
    selectedSubscriptionIndex,
    navigate,
  ]);

  const reloadEligibility = useCallback(() => {
    const sub = activeSubscription;
    if (!sub) return;
    setEligibilityFetchFailed(false);
    setEligibilityLoading(true);
    setEligibilityData(null);
    void fetchGymEligibility(sub.subscriptionId)
      .then(setEligibilityData)
      .catch((e) => {
        setEligibilityFetchFailed(true);
        toast.error(e instanceof Error ? e.message : "Gym eligibility failed");
      })
      .finally(() => setEligibilityLoading(false));
  }, [activeSubscription, toast]);

  return (
    <div className="gym-membership-page">
      <header className="hco-top">
        <Link to={ROUTES.services} className="hco-back" aria-label="Back to services">
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
        <h1 className="hco-title">Gym Membership</h1>
        <span className="hco-top__spacer" aria-hidden />
      </header>

      <main className="gym-membership-main">
        {loading ? (
          <p className="gym-membership-loading" aria-busy="true">
            Loading plans…
          </p>
        ) : null}

        {!loading && packagesRows.length === 0 ? (
          <div className="gym-membership-empty-wrap">
            <p className="gym-membership-empty">
              No gym memberships are available for your account right now.
            </p>
            <button type="button" className="gym-sub-retry" onClick={() => void loadInitial()}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && packagesRows.length > 0 ? (
          <>
            {packagesRows.length > 1 ? (
              <label className="gym-sub-picker">
                <span className="gym-sub-picker__label">Subscription</span>
                <select
                  className="gym-sub-picker__select"
                  value={selectedSubscriptionIndex}
                  onChange={(e) => selectSubscription(Number.parseInt(e.target.value, 10))}
                >
                  {packagesRows.map((row, idx) => (
                    <option key={row.subscriptionId || String(idx)} value={idx}>
                      {row.subscriptionId}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {eligibilityLoading ? (
              <div className="gym-sub-linear-wrap" aria-busy="true">
                <div className="gym-sub-linear" />
              </div>
            ) : null}

            {eligibilityData &&
            activeSubscription &&
            eligibilityData.subscriptionId === activeSubscription.subscriptionId &&
            !eligibilityData.gymModuleActive ? (
              <InfoBanner
                warning
                text="Gym membership is not available for this subscription."
              />
            ) : null}

            {eligibilityFetchFailed && activeSubscription ? (
              <div className="gym-sub-fail">
                <InfoBanner
                  warning
                  text="Could not verify who can purchase gym packages. Check your connection and try again."
                />
                <button type="button" className="gym-sub-retry-inline" onClick={reloadEligibility}>
                  Retry eligibility
                </button>
              </div>
            ) : null}

            {activeSubscription ? (
              <section className="gym-sub-packages">
                {activeSubscription.employeePackages.length > 0 ? (
                  <>
                    <h2 className="gym-sub-section-title">Employee packages</h2>
                    <div className="gym-sub-list">
                      {activeSubscription.employeePackages.map((p) => (
                        <EmployeePackageTile
                          key={p.packageCode}
                          p={p}
                          selected={selectedEmployeePackageCodes.includes(p.packageCode)}
                          eligibilityReady={eligibilityReady}
                          eligibilityData={eligibilityData}
                          empMid={empMid}
                          employeeName={employeeRow?.name ?? "Employee"}
                          onToggle={() => toggleEmployeePackage(p.packageCode)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {activeSubscription.dependentPackages.length > 0 ? (
                  <>
                    <h2 className="gym-sub-section-title">Dependent packages</h2>
                    <div className="gym-sub-list">
                      {activeSubscription.dependentPackages.map((p) => (
                        <DependentPackageTile
                          key={p.packageCode}
                          p={p}
                          selected={selectedDependentPackageCodes.includes(p.packageCode)}
                          selectedIds={dependentMemberIdsByPackage[p.packageCode] ?? []}
                          familyRows={familyRows}
                          eligibilityLoading={eligibilityLoading}
                          eligibilityData={eligibilityData}
                          onOpen={() => setDepModalPkg(p)}
                          isDependentSelectedInOtherPackage={isDependentSelectedInOtherPackage}
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {activeSubscription.employeePackages.length === 0 &&
                activeSubscription.dependentPackages.length === 0 ? (
                  <p className="gym-membership-empty">No packages listed for this subscription.</p>
                ) : null}
              </section>
            ) : null}

            <div className="gym-sub-footer-spacer" />
          </>
        ) : null}
      </main>

      {!loading && packagesRows.length > 0 ? (
        <footer className="gym-continue-footer">
          {canProceed ? (
            <button type="button" className="gym-continue-button" onClick={onContinue}>
              Continue
            </button>
          ) : (
            <span className="gym-continue-placeholder" />
          )}
        </footer>
      ) : null}

      {depModalPkg
        ? portalToMobileFrame(
            <DependentPickerModal
              pkg={depModalPkg}
              familyRows={familyRows}
              initialSelected={dependentMemberIdsByPackage[depModalPkg.packageCode] ?? []}
              eligibilityData={eligibilityData}
              eligibilityLoading={eligibilityLoading}
              isDependentSelectedInOtherPackage={isDependentSelectedInOtherPackage}
              onClose={() => setDepModalPkg(null)}
              onApply={(ids) => {
                applyDependentSelection(depModalPkg.packageCode, ids);
                setDepModalPkg(null);
              }}
            />,
          )
        : null}
    </div>
  );
}

function EmployeePackageTile({
  p,
  selected,
  eligibilityReady,
  eligibilityData,
  empMid,
  employeeName,
  onToggle,
}: Readonly<{
  p: GymEmployeePackage;
  selected: boolean;
  eligibilityReady: boolean;
  eligibilityData: GymEligibilityData | null;
  empMid: number;
  employeeName: string;
  onToggle: () => void;
}>) {
  const blockMsg = eligibilityReady ? memberGymEligibilityBlockMessage(eligibilityData, empMid) : null;
  const empBlocked = blockMsg != null;
  const hidePaymentDetails = empBlocked;
  const canInteract = !empBlocked || selected;

  return (
    <div
      className={`gym-pkg-tile${selected ? " gym-pkg-tile--selected" : ""}`}
    >
      <button
        type="button"
        className="gym-pkg-tile__main"
        disabled={!canInteract}
        onClick={onToggle}
      >
        <span
          className={`gym-pkg-tile__check${selected ? " gym-pkg-tile__check--on" : ""}`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
        <span className="gym-pkg-tile__body">
          <span className="gym-pkg-tile__title">{p.packageName}</span>
          <span className="gym-pkg-tile__meta">
            {hidePaymentDetails
              ? `${p.validityValue} ${p.validityUnits}`
              : `${p.validityValue} ${p.validityUnits} · Pay ₹${p.payAmount.toFixed(0)}`}
          </span>
          {blockMsg ? <InfoBanner warning text={blockMsg} /> : null}
          {selected ? (
            <>
              <span className="gym-pkg-tile__divider" />
              <span className="gym-pkg-tile__member">Member: {employeeName}</span>
            </>
          ) : null}
          {!hidePaymentDetails ? (
            <span className="gym-pkg-tile__coverage">
              {p.enableWallet ? (
                <span className="gym-pkg-wallet gym-pkg-wallet--free">
                  ✓ Covered by wallet — no payment needed
                </span>
              ) : (
                <span className="gym-pkg-wallet gym-pkg-wallet--pay">
                  Pay from pocket — ₹{p.payAmount.toFixed(0)} - the full package amount. Wallet is not used for this package.
                </span>
              )}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

function DependentPackageTile({
  p,
  selected,
  selectedIds,
  familyRows,
  eligibilityLoading,
  eligibilityData,
  onOpen,
  isDependentSelectedInOtherPackage,
}: Readonly<{
  p: GymDependentPackage;
  selected: boolean;
  selectedIds: readonly string[];
  familyRows: readonly GymMemberListRow[];
  eligibilityLoading: boolean;
  eligibilityData: GymEligibilityData | null;
  onOpen: () => void;
  isDependentSelectedInOtherPackage: (packageCode: string, memberId: string) => boolean;
}>) {
  const candidates = useMemo(() => dependentCandidates(familyRows, employeeMemberRow(familyRows)), [familyRows]);
  const selectedMembers = selectedIds
    .map((id) => familyRows.find((m) => m.id === id))
    .filter((x): x is GymMemberListRow => Boolean(x));

  const canOpen = candidates.length > 0 || selectedMembers.length > 0;

  return (
    <div className={`gym-pkg-tile${selected ? " gym-pkg-tile--selected" : ""}`}>
      <button
        type="button"
        className="gym-pkg-tile__main"
        disabled={!canOpen}
        onClick={onOpen}
      >
        <span
          className={`gym-pkg-tile__check${selected ? " gym-pkg-tile__check--on" : ""}`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
        <span className="gym-pkg-tile__body">
          <span className="gym-pkg-tile__title">{p.packageName}</span>
          <span className="gym-pkg-tile__meta">
            {p.validityValue} {p.validityUnits} · Price varies by city
          </span>
          {selectedMembers.length === 0 ? (
            candidates.length > 0 ? (
              <span className="gym-pkg-tile__hint gym-pkg-tile__hint--link">Tap to select dependents</span>
            ) : eligibilityLoading ? (
              <span className="gym-pkg-tile__hint">Checking eligibility…</span>
            ) : null
          ) : (
            <span className="gym-pkg-tile__chips">
              {selectedMembers.map((m) => (
                <span key={m.id} className="gym-pkg-chip">
                  {m.name}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function DependentPickerModal({
  pkg,
  familyRows,
  initialSelected,
  eligibilityData,
  eligibilityLoading,
  isDependentSelectedInOtherPackage,
  onClose,
  onApply,
}: Readonly<{
  pkg: GymDependentPackage;
  familyRows: readonly GymMemberListRow[];
  initialSelected: readonly string[];
  eligibilityData: GymEligibilityData | null;
  eligibilityLoading: boolean;
  isDependentSelectedInOtherPackage: (packageCode: string, memberId: string) => boolean;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}>) {
  const navigate = useNavigate();
  const candidates = useMemo(() => dependentCandidates(familyRows, employeeMemberRow(familyRows)), [familyRows]);
  const [selected, setSelected] = useState<string[]>([...initialSelected]);

  return (
    <div className="gym-dep-modal" role="dialog" aria-modal="true" aria-label="Select dependents">
      <button type="button" className="gym-dep-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="gym-dep-modal__sheet">
        <div className="gym-dep-modal__handle" aria-hidden />
        <h2 className="gym-dep-modal__title">Select dependents</h2>
        <p className="gym-dep-modal__pkg">{pkg.packageName}</p>
        <div className="gym-dep-modal__list">
          {candidates.length === 0 ? (
            <p className="gym-dep-modal__empty">
              No dependents available. Pull to refresh members or add a dependent in Family.
            </p>
          ) : (
            candidates.map((m) => {
              const checked = selected.includes(m.id);
              const rowUi = gymDependentPickerRowUi({
                member: m,
                packageCode: pkg.packageCode,
                checked,
                eligibility: eligibilityData,
                isDependentSelectedInOtherPackage,
              });
              return (
                <div
                  key={m.id}
                  className={`gym-dep-row${rowUi.cannotSelect ? " gym-dep-row--disabled" : ""}`}
                >
                  <label className="gym-dep-row__check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={rowUi.cannotSelect}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSelected((prev) => {
                          if (on) return [...prev, m.id];
                          return prev.filter((x) => x !== m.id);
                        });
                      }}
                    />
                    <span className="gym-dep-row__text">
                      <span className="gym-dep-row__name">{m.name}</span>
                      {rowUi.subtitle ? (
                        <span
                          className={`gym-dep-row__sub gym-dep-row__sub--${rowUi.subtitleVariant}`}
                        >
                          {rowUi.subtitle}
                        </span>
                      ) : m.subtitle ? (
                        <span className="gym-dep-row__sub gym-dep-row__sub--muted">{m.subtitle}</span>
                      ) : null}
                    </span>
                  </label>
                  {rowUi.showActivate ? (
                    <SubscriptionActivateCtaButton
                      onClick={() => {
                        onClose();
                        navigate(ROUTES.profileSubscriptions);
                      }}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        {eligibilityLoading ? (
          <p className="gym-dep-modal__wait">Checking eligibility…</p>
        ) : null}
        <div className="gym-dep-modal__actions">
          <button type="button" className="gym-dep-btn gym-dep-btn--outline" onClick={() => onApply([])}>
            Clear
          </button>
          <button
            type="button"
            className="gym-dep-btn gym-dep-btn--primary"
            disabled={selected.length === 0}
            onClick={() => onApply(selected)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
