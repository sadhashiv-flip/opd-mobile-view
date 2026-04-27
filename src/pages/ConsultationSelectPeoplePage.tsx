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
import { fetchAllPatientMembers } from "@/api/patientMember";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
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

function defaultSelection(rows: GymMemberListRow[]): string[] {
  const primary = rows.find((r) => r.section === "self");
  if (primary) return [primary.id];
  return rows[0] ? [rows[0].id] : [];
}

type SelectPeopleFlowPageProps = Readonly<{ flow: SelectPeopleFlowKind }>;

export function SelectPeopleFlowPage({ flow }: SelectPeopleFlowPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
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

  if (flow === "vision" && visionOption == null) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadMembers = async () => {
    const list = await fetchAllPatientMembers();
    setRows(patientMembersToGymRows(list));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    const run = async () => {
      try {
        const list = await fetchAllPatientMembers();
        if (!cancelled) setRows(patientMembersToGymRows(list));
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

  const maxSelectable = labTestsMulti ? Number.POSITIVE_INFINITY : 1;

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => rows.some((r) => r.id === id));
      if (next.length === 0) {
        next = defaultSelection(rows);
      }
      if (Number.isFinite(maxSelectable) && next.length > maxSelectable) {
        next = next.slice(0, maxSelectable);
      }
      return next;
    });
  }, [rows, labTestsMulti, maxSelectable]);

  const selfMembers = useMemo(() => rows.filter((m) => m.section === "self"), [rows]);
  const familyMembersList = useMemo(() => rows.filter((m) => m.section === "family"), [rows]);

  const canContinue = selectedIds.length > 0 && !loading && !fetchError && rows.length > 0;

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => {
      if (labTestsMulti) {
        return prev.includes(memberId)
          ? prev.filter((id) => id !== memberId)
          : [...prev, memberId];
      }
      return prev.includes(memberId) ? prev : [memberId];
    });
  };

  const renderTrailing = (member: GymMemberListRow) => {
    const isSelected = selectedIds.includes(member.id);
    if (isSelected) {
      return (
        <span className="hc-person__cta hc-person__cta--added" aria-hidden="true">
          <img src={selectSvg} alt="" width={18} height={18} draggable={false} />
        </span>
      );
    }
    return (
      <span className="hc-person__cta" aria-hidden="true">
        Add
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
        <Link to={ROUTES.orders} className="hco-orders">
          <span className="hco-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          <span>My Orders</span>
        </Link>
      </header>

      <main className="hc-main">
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

        {!loading && !fetchError && rows.length > 0 ? (
          <>
            {labTestsMulti ? (
              <p className="hc-block__subhint">
                Select one or more members for this lab booking. Tap again to remove someone from the list.
              </p>
            ) : null}
            <section className="hc-block">
              <h2 className="hc-block__title">For you</h2>
              {selfMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}`}
                  onClick={() => toggleMember(member.id)}
                >
                  <span className="hc-person__avatar" aria-hidden="true">
                    <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
                  </span>
                  <span className="hc-person__info">
                    <span className="hc-person__name">{member.name}</span>
                    <span className="hc-person__sub">{member.subtitle}</span>
                  </span>
                  {renderTrailing(member)}
                </button>
              ))}
            </section>

            <section className="hc-block">
              <h2 className="hc-block__title">For your family</h2>
              {familyMembersList.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}`}
                  onClick={() => toggleMember(member.id)}
                >
                  <span className="hc-person__avatar" aria-hidden="true">
                    <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
                  </span>
                  <span className="hc-person__info">
                    <span className="hc-person__name">{member.name}</span>
                    <span className="hc-person__sub">{member.subtitle}</span>
                  </span>
                  {renderTrailing(member)}
                </button>
              ))}

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
            </section>
          </>
        ) : null}
      </main>

      <footer className="hc-footer">
        <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
          {labTestsMulti && selectedIds.length > 0
            ? `Continue (${selectedIds.length})`
            : "Continue"}
        </button>
      </footer>
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
