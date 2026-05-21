import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { SelectPeopleMemberList } from "@/components/select-people/SelectPeopleMemberList";
import { toggleSelectPeopleMember } from "@/hooks/useSelectPeopleMemberSelection";
import type { GymMemberListRow } from "@/lib/gymMemberDisplay";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/HealthCheckupsPage.css";
import "@/pages/HealthCheckupsOverviewPage.css";
import "@/components/select-people/SelectPeopleBottomSheet.css";

export type PharmacyOrderingMemberSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  members: readonly GymMemberListRow[];
  /** While members are loading for the page */
  loading?: boolean;
  selectedMemberId: string | null;
  /** Persist choice; parent may close the sheet here */
  onApply: (row: GymMemberListRow) => void;
}>;

export function PharmacyOrderingMemberSheet({
  open,
  onClose,
  members,
  loading = false,
  selectedMemberId,
  onApply,
}: PharmacyOrderingMemberSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const mod = useProfileModuleGates();
  const canAddFamily = mod.planDependents.dependentAddAllowed;
  const rows = members;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const returnPath = `${location.pathname}${location.search}`;

  const memberListConfig = useMemo(
    () => ({
      showAhcSponsorSubtitle: false,
      restrictToAhcSelection: false,
      isDiagnosticsFlow: false,
      relaxMemberRestrictions: false,
    }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      return;
    }
    if (rows.length === 0) {
      setSelectedIds([]);
      return;
    }
    const id = selectedMemberId?.trim() ?? "";
    const rowForId = id ? rows.find((r) => r.id === id) : undefined;
    if (id && rowForId?.isSubscribed) {
      setSelectedIds([id]);
    } else {
      setSelectedIds([]);
    }
  }, [open, selectedMemberId, rows]);

  const toggleMember = (memberId: string) => {
    setSelectedIds(toggleSelectPeopleMember(memberId, [...rows], { allowDeselect: true }));
  };

  const goProfileSubscriptions = () => {
    void navigate(ROUTES.profileSubscriptions, {
      state: { returnPath },
    });
  };

  const canContinue = selectedIds.length > 0 && !loading && rows.length > 0;

  const onContinue = useCallback(() => {
    if (selectedIds.length === 0) return;
    const id = selectedIds[0];
    if (!id) return;
    const row = rows.find((r) => r.id === id) ?? null;
    if (!row) return;
    onApply(row);
  }, [rows, selectedIds, onApply]);

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="ph-ordering-member-title"
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
            <h1 id="ph-ordering-member-title" className="hco-title">
              Ordering for
            </h1>
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

          {!loading && rows.length === 0 ? (
            <p className="hc-member-empty">No members on your account. Add a family member to continue.</p>
          ) : null}

          {!loading && rows.length > 0 ? (
            <SelectPeopleMemberList
              members={[...rows]}
              selectedIds={selectedIds}
              onToggle={toggleMember}
              onNavigateSubscriptions={goProfileSubscriptions}
              config={memberListConfig}
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
