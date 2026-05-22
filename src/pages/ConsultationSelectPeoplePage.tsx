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
import { VIRTUAL_CONSULT_LANGUAGE_KEY } from "@/constants/virtualConsultationSessionStorage";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { SelectPeopleMemberList } from "@/components/select-people/SelectPeopleMemberList";
import {
  defaultGymMemberSelection,
  patientMembersToGymRows,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";
import { parseBoolSearchParam, SELECT_PEOPLE_COPY } from "@/lib/selectPeopleShared";
import { toggleSelectPeopleMember } from "@/hooks/useSelectPeopleMemberSelection";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import { deliveryAddressChooserAriaLabel } from "@/constants/selectedAddressStorage";
import { useToast } from "@/hooks/useToast";
import { Link, generatePath, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";

export type SelectPeopleFlowKind = "consultation" | "diagnostics" | "dental" | "vision";

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
  const diagnosticsTitle =
    type === "lab-tests" ? SELECT_PEOPLE_COPY.labTestsTitle : SELECT_PEOPLE_COPY.healthCheckupsTitle;
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

  const isDiagnosticsFlow = flow === "diagnostics";
  const isDentalFlow = flow === "dental";
  const isHealthCheckupsDiagnostics = isDiagnosticsFlow && type === "health-checkups";
  const isConsultationAtHospital = flow === "consultation" && type === "at_hospital";
  const isVisionFlow = flow === "vision";
  /**
   * Dental + vision (eye-checkup / glasses-lens): no age gate on member picker
   * (patient_app `DentalMemberSelectionScreen` / `VisionMemberSelectionScreen` — no `ageBlockReason`).
   */
  const relaxMemberRestrictions = isDentalFlow || isVisionFlow;
  /** patient_app: diagnostics, at-hospital consultation, dental, vision require address. */
  const requiresAddressSelection =
    isDiagnosticsFlow ||
    isConsultationAtHospital ||
    flow === "dental" ||
    flow === "vision";
  const showAhcSponsorSubtitle = isHealthCheckupsDiagnostics;

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
  /** Ephemeral — cleared whenever the language sheet opens, closes, or after Continue. */
  const [virtualLangChoice, setVirtualLangChoice] = useState("");

  const openVirtualLanguageSheet = () => {
    setVirtualLangChoice("");
    setVirtualLangSheetOpen(true);
  };

  const dismissVirtualLanguageSheet = () => {
    setVirtualLangChoice("");
    setVirtualLangSheetOpen(false);
    try {
      sessionStorage.removeItem(VIRTUAL_CONSULT_LANGUAGE_KEY);
    } catch {
      // ignore
    }
  };
  const hasDeliveryAddress = useHasSelectedDeliveryAddress();

  const selectionBasisRows = useMemo(() => {
    if (!isHealthCheckupsDiagnostics) return rows;
    if (!filterAhcDashboardEntry) return rows;
    return rows.filter((r) => r.ahcAvailable);
  }, [rows, isHealthCheckupsDiagnostics, filterAhcDashboardEntry]);

  /**
   * Prime `localStorage` sponsored flag for the plan step (`GET diagnostics/packages?…&sponsored=`).
   * Dashboard / deep link uses `?sponsored=1` / `?ahc=1`; general diagnostics clears stale `true` until Continue
   * sets it again from `AHCAvailable` (patient_app `applyEntryArguments` / `continueWithMemberSelection`).
   */
  useEffect(() => {
    if (!isHealthCheckupsDiagnostics) return;
    writeHealthSponsoredFlag(filterAhcDashboardEntry);
  }, [isHealthCheckupsDiagnostics, filterAhcDashboardEntry, location.key]);

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
    if (!requiresAddressSelection) return;
    void ensureDefaultSelectedAddressIfNeeded();
  }, [requiresAddressSelection]);

  const hasSelectedAhcMember = useMemo(
    () =>
      selectedIds.some((id) => rows.find((r) => r.id === id)?.ahcAvailable === true),
    [selectedIds, rows],
  );

  const restrictToAhcSelection =
    isHealthCheckupsDiagnostics && (filterAhcDashboardEntry || hasSelectedAhcMember);

  const memberListConfig = useMemo(
    () => ({
      showAhcSponsorSubtitle,
      restrictToAhcSelection,
      isDiagnosticsFlow,
      relaxMemberRestrictions,
    }),
    [showAhcSponsorSubtitle, restrictToAhcSelection, isDiagnosticsFlow, relaxMemberRestrictions],
  );

  const returnPath = `${location.pathname}${location.search}`;

  const hideAddFamilyOnPicker =
    isHealthCheckupsDiagnostics && filterAhcDashboardEntry;

  useEffect(() => {
    if (selectionBasisRows.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return false;
        if (!relaxMemberRestrictions && !r.isSubscribed) {
          return false;
        }
        return selectionBasisRows.some((s) => s.id === id);
      });
      /** User must pick a member explicitly (no default selection). */
      const skipAutoPick =
        isDiagnosticsFlow ||
        flow === "consultation" ||
        flow === "dental" ||
        flow === "vision";
      if (next.length === 0 && !skipAutoPick) {
        next = defaultGymMemberSelection(selectionBasisRows);
      }
      if (next.length > 1) {
        next = next.slice(0, 1);
      }
      return next;
    });
  }, [selectionBasisRows, isDiagnosticsFlow, rows, flow, type, relaxMemberRestrictions]);

  const canContinue =
    selectedIds.length > 0 &&
    !loading &&
    !fetchError &&
    selectionBasisRows.length > 0 &&
    (!requiresAddressSelection || hasDeliveryAddress);

  const toggleMember = (memberId: string) => {
    setSelectedIds(
      toggleSelectPeopleMember(memberId, rows, {
        allowDeselect: true,
        restrictToAhcSelection,
        isHealthCheckupsDiagnostics,
        relaxMemberRestrictions,
      }),
    );
  };

  const goProfileSubscriptions = () => {
    void navigate(ROUTES.profileSubscriptions, {
      state: { returnPath: `${location.pathname}${location.search}` },
    });
  };

  const continueButtonLabel = (() => {
    if (requiresAddressSelection && !hasDeliveryAddress) {
      if (selectedIds.length === 0) {
        return isConsultationAtHospital
          ? SELECT_PEOPLE_COPY.selectHospitalLocationToContinue
          : SELECT_PEOPLE_COPY.addAddressAndSelectMembers;
      }
      return isConsultationAtHospital
        ? SELECT_PEOPLE_COPY.selectHospitalLocationToContinue
        : SELECT_PEOPLE_COPY.addAddressToContinue;
    }
    if (requiresAddressSelection && selectedIds.length === 0) {
      return SELECT_PEOPLE_COPY.selectMemberToContinue;
    }
    return "Continue";
  })();

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
        openVirtualLanguageSheet();
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

    const pickedRows = selectedIds
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is GymMemberListRow => r != null);
    if (pickedRows.length === 0) return;

    const includeSponsored = pickedRows.some((r) => r.ahcAvailable);
    const chosen =
      isHealthCheckupsDiagnostics && includeSponsored
        ? pickedRows.filter((r) => r.ahcAvailable)
        : pickedRows;
    const snapshots = chosen.map(buildDiagnosticsMemberSnapshotFromRow);
    if (snapshots.length === 0) return;

    writeDiagnosticsSelectedPersonIds(chosen.map((r) => r.id));
    writeDiagnosticsSelectedMembersSnapshots(snapshots);
    if (isHealthCheckupsDiagnostics) {
      writeHealthSponsoredFlag(includeSponsored);
    }
    try {
      localStorage.setItem(
        "opd-mobile-view.health-checkups.selectedPersonId",
        chosen[0]?.id ?? "",
      );
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
        {requiresAddressSelection ? (
          <div className="hc-loc-wrap">
            <button
              type="button"
              className="hc-select-loc"
              aria-label={
                hasDeliveryAddress
                  ? deliveryAddressChooserAriaLabel(true)
                  : isConsultationAtHospital
                    ? "Select hospital location"
                    : deliveryAddressChooserAriaLabel(false)
              }
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
            {SELECT_PEOPLE_COPY.noAhcEligibleMembers}
          </p>
        ) : null}

        {!loading && !fetchError && selectionBasisRows.length > 0 ? (
          <SelectPeopleMemberList
            members={selectionBasisRows}
            selectedIds={selectedIds}
            onToggle={toggleMember}
            onNavigateSubscriptions={goProfileSubscriptions}
            config={memberListConfig}
            canAddFamily={canAddFamily}
            hideAddFamily={hideAddFamilyOnPicker}
            returnPath={returnPath}
          />
        ) : null}
      </main>

      <footer className="hc-footer">
        <button
          type="button"
          className="bottom-continue"
          disabled={!canContinue}
          onClick={onContinue}
          title={
            requiresAddressSelection && !hasDeliveryAddress
              ? isConsultationAtHospital
                ? "Please select a hospital location"
                : "Please add a delivery address"
              : ""
          }
        >
          {continueButtonLabel}
        </button>
      </footer>

      {requiresAddressSelection ? (
        <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
      ) : null}

      {flow === "consultation" && type === "virtual" ? (
        <VirtualLanguageBottomSheet
          open={virtualLangSheetOpen}
          onClose={dismissVirtualLanguageSheet}
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
            setVirtualLangChoice("");
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
