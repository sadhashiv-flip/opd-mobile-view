import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { ROUTES } from "@/constants";
import {
  buildConsultMemberSnapshotFromRow,
  CONSULT_SELECTED_PERSON_KEY,
  writeConsultSelectedMembersSnapshots,
  writeConsultSelectedPersonIds,
} from "@/constants/consultationSelectedMemberStorage";
import { SelectPeopleMemberList } from "@/components/select-people/SelectPeopleMemberList";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { defaultSingleSelectHint } from "@/lib/selectPeopleShared";
import { toggleSelectPeopleMember } from "@/hooks/useSelectPeopleMemberSelection";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useToast } from "@/hooks/useToast";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/HealthCheckupsPage.css";
import "@/pages/HealthCheckupsOverviewPage.css";
import "@/components/select-people/SelectPeopleBottomSheet.css";

export type SelectPeopleBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** After selection is persisted (e.g. consultation storage); parent may refresh UI. */
  onApplied?: () => void;
}>;

function readStoredPersonId(): string | null {
  try {
    const raw = localStorage.getItem(CONSULT_SELECTED_PERSON_KEY);
    return raw?.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function SelectPeopleBottomSheet({ open, onClose, onApplied }: SelectPeopleBottomSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const mod = useProfileModuleGates();
  const canAddFamily = mod.planDependents.dependentAddAllowed;
  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const returnPath = `${location.pathname}${location.search}`;

  const memberListConfig = useMemo(
    () => ({
      showAhcSponsorSubtitle: false,
      restrictToAhcSelection: false,
      isDiagnosticsFlow: false,
    }),
    [],
  );

  const loadMembers = useCallback(async () => {
    const [list, canAct] = await Promise.all([
      fetchAllPatientMembers(),
      fetchAnySubscriptionCanActivate(),
    ]);
    setRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
  }, []);

  useEffect(() => {
    if (!open) return;
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
  }, [open, toast]);

  useEffect(() => {
    if (!open || rows.length === 0) {
      if (!open) setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => {
        const r = rows.find((x) => x.id === id);
        return Boolean(r?.isSubscribed);
      });
      if (next.length === 0) {
        const stored = readStoredPersonId();
        if (stored) {
          const storedRow = rows.find((r) => r.id === stored);
          if (storedRow?.isSubscribed) next = [stored];
        }
      }
      return next.length > 1 ? next.slice(0, 1) : next;
    });
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const toggleMember = (memberId: string) => {
    setSelectedIds(toggleSelectPeopleMember(memberId, rows, { allowDeselect: true }));
  };

  const goProfileSubscriptions = () => {
    void navigate(ROUTES.profileSubscriptions, {
      state: { returnPath },
    });
  };

  const canContinue = selectedIds.length > 0 && !loading && !fetchError && rows.length > 0;

  const onContinue = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selected = selectedIds[0];
    if (!selected) return;
    const row = rows.find((r) => r.id === selected) ?? null;
    if (!row) return;
    writeConsultSelectedPersonIds([selected]);
    writeConsultSelectedMembersSnapshots([buildConsultMemberSnapshotFromRow(row)]);
    onApplied?.();
    onClose();
  }, [rows, selectedIds, onApplied, onClose]);

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="hcp-sp-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="hcp-sp-sheet">
        <header className="hcp-sp-top">
          <div className="hco-title-wrap">
            <h1 id="hcp-sp-title" className="hco-title">
              Consultation
            </h1>
            <span className="hco-consult-mode">Virtual</span>
          </div>
          <button type="button" className="addr-sheet__close" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
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
            <SelectPeopleMemberList
              members={rows}
              selectedIds={selectedIds}
              onToggle={toggleMember}
              onNavigateSubscriptions={goProfileSubscriptions}
              config={memberListConfig}
              selectionHint={defaultSingleSelectHint()}
              canAddFamily={canAddFamily}
              returnPath={returnPath}
              onAddFamily={() => {
                onClose();
                navigate(ROUTES.profileMembersAdd, { state: { returnPath } });
              }}
            />
          ) : null}
        </main>

        <footer className="hc-footer">
          <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
            Continue
          </button>
        </footer>
      </div>
    </dialog>
  );
}
