import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { VISION_FLOW_OPTION_KEY, type VisionSheetOption } from "@/constants/visionBookingStorage";
import {
  buildConsultMemberSnapshotFromRow,
  writeConsultSelectedMembersSnapshots,
  writeConsultSelectedPersonIds,
} from "@/constants/consultationSelectedMemberStorage";
import {
  buildDiagnosticsMemberSnapshotFromRow,
  writeDiagnosticsSelectedMembersSnapshots,
  writeDiagnosticsSelectedPersonIds,
} from "@/constants/diagnosticsSelectedMemberStorage";
import { writeHealthSponsoredFlag } from "@/constants/diagnosticsHealthFlowStorage";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { VirtualLanguageBottomSheet } from "@/components/consultation/VirtualLanguageBottomSheet";
import { isConsultationLanguageValue } from "@/constants/consultationLanguages";
import { VIRTUAL_CONSULT_LANGUAGE_KEY } from "@/constants/virtualConsultationSessionStorage";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import { SubscriptionActivateCtaButton } from "@/components/select-people/SubscriptionActivateCtaButton";
import {
  defaultGymMemberSelection,
  HC_PERSON_ADD_CTA_DISABLED_TOOLTIP,
  HC_PERSON_ADD_CTA_TOOLTIP,
  HC_PERSON_NOT_ACTIVATED_CTA_TOOLTIP,
  memberShowsSubscriptionActivateCta,
  MEMBER_NOT_ACTIVATED_LABEL,
  patientMembersToGymRows,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { useToast } from "@/hooks/useToast";
import { Link, generatePath, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";

export type SelectPeopleFlowKind = "consultation" | "diagnostics" | "dental" | "vision";

/** Lab tests — patient_app `LabTestMemberSelectionScreen` uses `CommonMemberSelectionScreen(allowMultiSelect: true)`. */
function isLabTestsDiagnosticsFlow(flow: SelectPeopleFlowKind, diagnosticsType: string): boolean {
  return flow === "diagnostics" && diagnosticsType === "lab-tests";
}

function parseBoolSearchParam(sp: URLSearchParams, key: string): boolean {
  const v = sp.get(key)?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Health-checkups only — mutual exclusion between sponsored-eligible and other members (patient_app). */
function healthCheckupsMemberPickDisabled(
  member: GymMemberListRow,
  selectedIds: readonly string[],
  allRows: readonly GymMemberListRow[],
): boolean {
  const selected = selectedIds
    .map((id) => allRows.find((r) => r.id === id))
    .filter((r): r is GymMemberListRow => r != null);
  if (selected.length === 0) return false;
  const anyAhc = selected.some((s) => s.ahcAvailable);
  const anyNonAhc = selected.some((s) => !s.ahcAvailable);
  if (anyAhc && !member.ahcAvailable) return true;
  if (anyNonAhc && member.ahcAvailable) return true;
  return false;
}

type SelectPeopleFlowPageProps = Readonly<{ flow: SelectPeopleFlowKind }>;

export function SelectPeopleFlowPage({ flow }: SelectPeopleFlowPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const mod = useProfileModuleGates();
  const canAddFamily = mod.planDependents.dependentAddAllowed;
  const params = useParams();
  let type: string;
  if (typeof params.type === "string") {
    type = params.type;
  } else if (flow === "consultation") {
    type = "virtual";
  } else {
    type = "health-checkups";
  }

  const consultationLabel = type === "at_hospital" ? "At Hospital" : "Virtual";
  const diagnosticsTitle = type === "lab-tests" ? "Lab Tests" : "Health Checkups";
  let headerTitle: string;
  if (flow === "consultation") {
    headerTitle = "Consultation";
  } else if (flow === "vision") {
    headerTitle = "Vision";
  } else if (flow === "dental") {
    headerTitle = "Dental";
  } else {
    headerTitle = diagnosticsTitle;
  }

  const visionTypeParam = params.visionType?.trim();
  const visionOption = useMemo((): VisionSheetOption | undefined => {
    if (visionTypeParam === VISION_ROUTE_TYPE.eyeCheckup || visionTypeParam === VISION_ROUTE_TYPE.glassesLens) {
      return visionTypeParam;
    }
    const s = location.state;
    if (s && typeof s === "object" && "visionOption" in s) {
      const v = (s as { visionOption?: unknown }).visionOption;
      return v === "eye-checkup" || v === "glasses-lens" ? v : undefined;
    }
    return undefined;
  }, [visionTypeParam, location.state]);
  const visionModeLabel =
    visionOption === "eye-checkup" ? "Eye Checkup" : visionOption === "glasses-lens" ? "Glasses/Lens" : null;

  const labTestsMulti = isLabTestsDiagnosticsFlow(flow, type);
  const isHealthCheckupsDiagnostics = flow === "diagnostics" && type === "health-checkups";
  /** Lab tests and health checkups allow multiple members (health keeps sponsored / non-sponsored exclusion). */
  const diagnosticsMultiMember = labTestsMulti || isHealthCheckupsDiagnostics;

  const filterAhcDashboardEntry = useMemo(() => {
    if (!isHealthCheckupsDiagnostics) return false;
    const sp = new URLSearchParams(location.search);
    return parseBoolSearchParam(sp, "sponsored") || parseBoolSearchParam(sp, "ahc");
  }, [isHealthCheckupsDiagnostics, location.search]);

  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const [virtualLangSheetOpen, setVirtualLangSheetOpen] = useState(false);
  const [virtualLangChoice, setVirtualLangChoice] = useState("");
  const hcLocAddrRaw = useSelectedAddressLine("");

  const selectionBasisRows = useMemo(() => {
    if (!isHealthCheckupsDiagnostics) return rows;
    if (!filterAhcDashboardEntry) return rows;
    return rows.filter((r) => r.ahcAvailable);
  }, [rows, isHealthCheckupsDiagnostics, filterAhcDashboardEntry]);

  const loadMembers = async () => {
    const [list, canAct] = await Promise.all([
      fetchAllPatientMembers(),
      fetchAnySubscriptionCanActivate(),
    ]);
    setRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    const run = async () => {
      try {
        const [list, canAct] = await Promise.all([
          fetchAllPatientMembers(),
          fetchAnySubscriptionCanActivate(),
        ]);
        if (!cancelled) setRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          const msg = e instanceof Error ? e.message : "Could not load members";
          setFetchError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [toast, location.key]);

  useEffect(() => {
    if (!isHealthCheckupsDiagnostics) return;
    void ensureDefaultSelectedAddressIfNeeded();
  }, [isHealthCheckupsDiagnostics]);

  const maxSelectable = diagnosticsMultiMember ? Number.POSITIVE_INFINITY : 1;

  useEffect(() => {
    if (selectionBasisRows.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => {
        const r = rows.find((x) => x.id === id);
        return Boolean(r?.isSubscribed) && selectionBasisRows.some((s) => s.id === id);
      });
      const consultationAtHospitalNoAutoPick =
        flow === "consultation" && type === "at_hospital";
      if (next.length === 0 && !isHealthCheckupsDiagnostics && !consultationAtHospitalNoAutoPick) {
        next = defaultGymMemberSelection(selectionBasisRows);
      }
      if (Number.isFinite(maxSelectable) && next.length > maxSelectable) {
        next = next.slice(0, maxSelectable);
      }
      return next;
    });
  }, [selectionBasisRows, maxSelectable, isHealthCheckupsDiagnostics, rows, flow, type]);

  const selfMembers = useMemo(
    () => selectionBasisRows.filter((m) => m.section === "self"),
    [selectionBasisRows],
  );
  const familyMembersList = useMemo(
    () => selectionBasisRows.filter((m) => m.section === "family"),
    [selectionBasisRows],
  );

  const canContinue =
    selectedIds.length > 0 && !loading && !fetchError && selectionBasisRows.length > 0;

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => {
      const targetRow = rows.find((r) => r.id === memberId);
      if (!targetRow?.isSubscribed) return prev;
      if (labTestsMulti) {
        return prev.includes(memberId)
          ? prev.filter((id) => id !== memberId)
          : [...prev, memberId];
      }
      if (isHealthCheckupsDiagnostics) {
        const row = rows.find((r) => r.id === memberId);
        if (!row) return prev;
        if (
          !prev.includes(memberId) &&
          healthCheckupsMemberPickDisabled(row, prev, rows)
        ) {
          return prev;
        }
        return prev.includes(memberId)
          ? prev.filter((id) => id !== memberId)
          : [...prev, memberId];
      }
      return prev.includes(memberId) ? prev : [memberId];
    });
  };

  const goProfileSubscriptions = () => {
    void navigate(ROUTES.profileSubscriptions, {
      state: { returnPath: `${location.pathname}${location.search}` },
    });
  };

  const renderTrailing = (member: GymMemberListRow, rowDisabled: boolean) => {
    const isSelected = selectedIds.includes(member.id);
    if (isSelected) {
      return (
        <span className="hc-person__cta hc-person__cta--added" aria-hidden="true">
          <img src={selectSvg} alt="" width={18} height={18} draggable={false} />
        </span>
      );
    }
    if (memberShowsSubscriptionActivateCta(member)) {
      return <SubscriptionActivateCtaButton onClick={goProfileSubscriptions} />;
    }
    const ctaLabel = !member.isSubscribed ? MEMBER_NOT_ACTIVATED_LABEL : "Add";
    const addTitle =
      member.isSubscribed && !rowDisabled
        ? HC_PERSON_ADD_CTA_TOOLTIP
        : member.isSubscribed && rowDisabled
          ? HC_PERSON_ADD_CTA_DISABLED_TOOLTIP
          : undefined;
    return (
      <span
        className={`hc-person__cta${rowDisabled ? " hc-person__cta--disabled" : ""}`}
        aria-hidden="true"
        title={ctaLabel === "Add" ? addTitle : HC_PERSON_NOT_ACTIVATED_CTA_TOOLTIP}
      >
        {ctaLabel}
      </span>
    );
  };

  const onContinue = () => {
    if (selectedIds.length === 0) return;

    if (flow === "consultation") {
      const selected = selectedIds[0];
      if (!selected) return;
      const row = rows.find((r) => r.id === selected) ?? null;
      if (!row) return;
      writeConsultSelectedPersonIds([selected]);
      writeConsultSelectedMembersSnapshots([buildConsultMemberSnapshotFromRow(row)]);
      if (type === "virtual") {
        try {
          const raw = sessionStorage.getItem(VIRTUAL_CONSULT_LANGUAGE_KEY)?.trim();
          setVirtualLangChoice(raw && isConsultationLanguageValue(raw) ? raw : "");
        } catch {
          setVirtualLangChoice("");
        }
        setVirtualLangSheetOpen(true);
        return;
      }
      navigate(generatePath(ROUTES.consultationSpecialties, { type }));
      return;
    }

    if (flow === "dental") {
      const selected = selectedIds[0];
      if (!selected) return;
      const row = rows.find((r) => r.id === selected) ?? null;
      if (!row) return;
      writeDiagnosticsSelectedPersonIds([selected]);
      writeDiagnosticsSelectedMembersSnapshots([buildDiagnosticsMemberSnapshotFromRow(row)]);
      navigate(ROUTES.dentalNetworkList);
      return;
    }

    if (flow === "vision") {
      if (!visionOption) return;
      const selected = selectedIds[0];
      if (!selected) return;
      const row = rows.find((r) => r.id === selected) ?? null;
      if (!row) return;
      writeDiagnosticsSelectedPersonIds([selected]);
      writeDiagnosticsSelectedMembersSnapshots([buildDiagnosticsMemberSnapshotFromRow(row)]);
      try {
        sessionStorage.setItem(VISION_FLOW_OPTION_KEY, visionOption);
      } catch {
        // ignore
      }
      void navigate(
        generatePath(ROUTES.visionNetworkList, { visionType: visionOption }),
        { state: { visionOption } },
      );
      return;
    }

    const snapshots = selectedIds
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is GymMemberListRow => r != null)
      .map(buildDiagnosticsMemberSnapshotFromRow);
    if (snapshots.length === 0) return;

    writeDiagnosticsSelectedPersonIds(selectedIds);
    writeDiagnosticsSelectedMembersSnapshots(snapshots);
    if (type === "health-checkups") {
      const pickedRows = selectedIds
        .map((id) => rows.find((r) => r.id === id))
        .filter((r): r is GymMemberListRow => r != null);
      writeHealthSponsoredFlag(pickedRows.some((r) => r.ahcAvailable));
    }
    try {
      localStorage.setItem("opd-mobile-view.health-checkups.selectedPersonId", selectedIds[0] ?? "");
    } catch {
      // ignore
    }
    navigate({
      pathname: generatePath(ROUTES.diagnosticsPlan, { type }),
      search: location.search,
    });
  };

  if (flow === "vision" && visionOption == null) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="hc-page">
      <header className="hco-top">
        <Link to={ROUTES.dashboard} className="hco-back" aria-label="Back to home">
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
        {flow === "consultation" ? (
          <div className="hco-title-wrap">
            <h1 className="hco-title">{headerTitle}</h1>
            <span className="hco-consult-mode">{consultationLabel}</span>
          </div>
        ) : flow === "vision" && visionModeLabel ? (
          <div className="hco-title-wrap">
            <h1 className="hco-title">{headerTitle}</h1>
            <span className="hco-consult-mode">{visionModeLabel}</span>
          </div>
        ) : (
          <h1 className="hco-title">{headerTitle}</h1>
        )}
        <span className="hco-top__spacer" aria-hidden />
      </header>

      <main className="hc-main">
        {isHealthCheckupsDiagnostics ? (
          <div className="hc-loc-wrap">
            <button
              type="button"
              className="hc-select-loc"
              aria-label={hcLocAddrRaw.trim() ? "Choose address" : "Add delivery address"}
              onClick={() => setAddrSheetOpen(true)}
            >
              <span className="hc-select-loc__pin" aria-hidden="true">
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
                addrRaw={hcLocAddrRaw}
                titleClassName="hc-select-loc__title"
                sepClassName="hc-select-loc__sep"
                addrClassName="hc-select-loc__addr"
                promptClassName="hc-select-loc__addr hc-select-loc__addr--prompt"
              />
              <span className="hc-select-loc__chev" aria-hidden="true">
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
          </div>
        ) : null}

        {loading ? (
          <p className="hc-member-loading" aria-busy="true">
            Loading members…
          </p>
        ) : null}

        {!loading && fetchError ? (
          <div className="hc-member-error">
            <p className="hc-member-error__text">{fetchError}</p>
            <button
              type="button"
              className="bottom-continue"
              onClick={() => {
                setFetchError(null);
                setLoading(true);
                void (async () => {
                  try {
                    await loadMembers();
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "Could not load members";
                    setFetchError(msg);
                    toast.error(msg);
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !fetchError && rows.length === 0 ? (
          <p className="hc-member-empty">No members on your account. Add a family member to continue.</p>
        ) : null}

        {!loading && !fetchError && rows.length > 0 && selectionBasisRows.length === 0 && isHealthCheckupsDiagnostics && filterAhcDashboardEntry ? (
          <p className="hc-member-empty" role="alert">
            No members are eligible for the sponsored health checkup yet.
          </p>
        ) : null}

        {!loading && !fetchError && selectionBasisRows.length > 0 ? (
          <>
            {diagnosticsMultiMember ? (
              <p className="hc-block__subhint">
                {labTestsMulti
                  ? "Select one or more members for this lab booking. Tap again to remove someone from the list."
                  : "Select one or more members for this health checkup. Sponsored-eligible and other members cannot be mixed — tap again to remove someone from the list."}
              </p>
            ) : null}
            {isHealthCheckupsDiagnostics ? (
              <div
                className={`hc-selection-hint${filterAhcDashboardEntry ? " hc-selection-hint--sponsored" : ""}`}
                role="note"
              >
                <span className="hc-selection-hint__ic" aria-hidden>
                  {filterAhcDashboardEntry ? "✓" : "i"}
                </span>
                <p className="hc-selection-hint__text">
                  {filterAhcDashboardEntry
                    ? "Sponsored checkup is available for eligible members."
                    : "Members eligible for a sponsored checkup are labeled below. You cannot combine sponsored-eligible and other members — pick one group."}
                </p>
              </div>
            ) : null}
            <section className="hc-block">
              <h2 className="hc-block__title">For you</h2>
              {selfMembers.map((member) => {
                const canSubActivate = memberShowsSubscriptionActivateCta(member);
                const notActivated = !member.isSubscribed;
                const rowDisabled =
                  notActivated ||
                  (isHealthCheckupsDiagnostics &&
                    healthCheckupsMemberPickDisabled(member, selectedIds, rows));
                const showInactiveTag = notActivated && !canSubActivate;
                const rowClass = `hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}${rowDisabled && !canSubActivate ? " hc-person--disabled" : ""}${canSubActivate ? " hc-person--subscription-activate" : ""}`;
                const body = (
                  <>
                    <span className="hc-person__avatar" aria-hidden="true">
                      <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
                    </span>
                    <span className="hc-person__info">
                      <span className="hc-person__name">{member.name}</span>
                      {showInactiveTag ? (
                        <span className="hc-person__tag hc-person__tag--inactive">{MEMBER_NOT_ACTIVATED_LABEL}</span>
                      ) : null}
                      {isHealthCheckupsDiagnostics && member.ahcAvailable ? (
                        <span className="hc-person__tag hc-person__tag--sponsored">Sponsored</span>
                      ) : null}
                      <span className="hc-person__sub">{member.subtitle}</span>
                    </span>
                    {renderTrailing(member, rowDisabled)}
                  </>
                );
                if (canSubActivate) {
                  return (
                    <div key={member.id} className={rowClass}>
                      {body}
                    </div>
                  );
                }
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={rowDisabled}
                    className={rowClass}
                    onClick={() => toggleMember(member.id)}
                  >
                    {body}
                  </button>
                );
              })}
            </section>

            <section className="hc-block">
              {familyMembersList.length > 0 ? (
                <>
                  <h2 className="hc-block__title">For your family</h2>
                  {familyMembersList.map((member) => {
                    const canSubActivate = memberShowsSubscriptionActivateCta(member);
                    const notActivated = !member.isSubscribed;
                    const rowDisabled =
                      notActivated ||
                      (isHealthCheckupsDiagnostics &&
                        healthCheckupsMemberPickDisabled(member, selectedIds, rows));
                    const showInactiveTag = notActivated && !canSubActivate;
                    const rowClass = `hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}${rowDisabled && !canSubActivate ? " hc-person--disabled" : ""}${canSubActivate ? " hc-person--subscription-activate" : ""}`;
                    const body = (
                      <>
                        <span className="hc-person__avatar" aria-hidden="true">
                          <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
                        </span>
                        <span className="hc-person__info">
                          <span className="hc-person__name">{member.name}</span>
                          {showInactiveTag ? (
                            <span className="hc-person__tag hc-person__tag--inactive">{MEMBER_NOT_ACTIVATED_LABEL}</span>
                          ) : null}
                          {isHealthCheckupsDiagnostics && member.ahcAvailable ? (
                            <span className="hc-person__tag hc-person__tag--sponsored">Sponsored</span>
                          ) : null}
                          <span className="hc-person__sub">{member.subtitle}</span>
                        </span>
                        {renderTrailing(member, rowDisabled)}
                      </>
                    );
                    if (canSubActivate) {
                      return (
                        <div key={member.id} className={rowClass}>
                          {body}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={member.id}
                        type="button"
                        disabled={rowDisabled}
                        className={rowClass}
                        onClick={() => toggleMember(member.id)}
                      >
                        {body}
                      </button>
                    );
                  })}
                </>
              ) : null}

              {!(isHealthCheckupsDiagnostics && filterAhcDashboardEntry) && canAddFamily ? (
                <button
                  type="button"
                  className="hc-add-family"
                  onClick={() =>
                    navigate(ROUTES.profileMembersAdd, {
                      state: { returnPath: `${location.pathname}${location.search}` },
                    })
                  }
                >
                  <span className="hc-add-family__ic" aria-hidden="true">
                    +
                  </span>
                  <span> Add new family member</span>
                </button>
              ) : null}
            </section>
          </>
        ) : null}
      </main>

      <footer className="hc-footer">
        <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
          {diagnosticsMultiMember && selectedIds.length > 0
            ? `Continue (${selectedIds.length})`
            : "Continue"}
        </button>
      </footer>

      {isHealthCheckupsDiagnostics ? (
        <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
      ) : null}

      {flow === "consultation" && type === "virtual" ? (
        <VirtualLanguageBottomSheet
          open={virtualLangSheetOpen}
          onClose={() => setVirtualLangSheetOpen(false)}
          issueTitle=""
          language={virtualLangChoice}
          onLanguageChange={setVirtualLangChoice}
          continueDisabled={!virtualLangChoice.trim()}
          onContinue={() => {
            const lang = virtualLangChoice.trim();
            if (!lang) return;
            try {
              sessionStorage.setItem(VIRTUAL_CONSULT_LANGUAGE_KEY, lang);
            } catch {
              // ignore
            }
            setVirtualLangSheetOpen(false);
            navigate(generatePath(ROUTES.consultationSpecialties, { type }));
          }}
        />
      ) : null}
    </div>
  );
}

export function ConsultationSelectPeoplePage() {
  return <SelectPeopleFlowPage flow="consultation" />;
}

export function DiagnosticsSelectPeoplePage() {
  return <SelectPeopleFlowPage flow="diagnostics" />;
}

export function DentalSelectPeoplePage() {
  return <SelectPeopleFlowPage flow="dental" />;
}

export function VisionSelectPeoplePage() {
  return <SelectPeopleFlowPage flow="vision" />;
}
