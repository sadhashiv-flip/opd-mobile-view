import { ROUTES } from "@/constants";
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
import { fetchPatientMembers } from "@/api/patientMember";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { useToast } from "@/hooks/useToast";
import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";

export type SelectPeopleFlowKind = "consultation" | "diagnostics";

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
  const headerTitle = flow === "consultation" ? "Consultation" : diagnosticsTitle;

  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadMembers = async () => {
    const list = await fetchPatientMembers();
    setRows(patientMembersToGymRows(list));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    const run = async () => {
      try {
        const list = await fetchPatientMembers();
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

  const maxSelectable = 1;

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
      if (next.length > maxSelectable) next = next.slice(0, maxSelectable);
      return next;
    });
  }, [rows]);

  const selfMembers = useMemo(() => rows.filter((m) => m.section === "self"), [rows]);
  const familyMembersList = useMemo(() => rows.filter((m) => m.section === "family"), [rows]);

  const canContinue = selectedIds.length > 0 && !loading && !fetchError && rows.length > 0;

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => (prev.includes(memberId) ? prev : [memberId]));
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
    const selected = selectedIds[0];
    if (!selected) return;
    const row = rows.find((r) => r.id === selected) ?? null;
    if (!row) return;

    if (flow === "consultation") {
      writeConsultSelectedPersonIds([selected]);
      writeConsultSelectedMembersSnapshots([buildConsultMemberSnapshotFromRow(row)]);
      navigate(generatePath(ROUTES.consultationSpecialties, { type }));
      return;
    }

    writeDiagnosticsSelectedPersonIds([selected]);
    writeDiagnosticsSelectedMembersSnapshots([buildDiagnosticsMemberSnapshotFromRow(row)]);
    try {
      localStorage.setItem("opd-mobile-view.health-checkups.selectedPersonId", selected);
    } catch {
      // ignore
    }
    navigate(generatePath(ROUTES.diagnosticsPlan, { type }));
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
        <h1 className="hco-title">{headerTitle}</h1>
        <Link to={ROUTES.orders} className="hco-orders">
          <span className="hco-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          <span>My Orders</span>
        </Link>
      </header>

      <main className="hc-main">
        {flow === "consultation" ? (
          <div className="hc-block" style={{ paddingTop: 0 }}>
            <div className="hc-mode" style={{ margin: "0 0 10px" }}>
              {consultationLabel}
            </div>
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
              className="hc-continue"
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

              <button type="button" className="hc-add-family" onClick={() => navigate(ROUTES.profileMembersAdd)}>
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
        <button type="button" className="hc-continue" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      </footer>
    </div>
  );
}

export function ConsultationSelectPeoplePage() {
  return <SelectPeopleFlowPage flow="consultation" />;
}
