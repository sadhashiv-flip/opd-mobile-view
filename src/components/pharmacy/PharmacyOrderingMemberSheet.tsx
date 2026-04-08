import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
import type { GymMemberListRow } from "@/lib/gymMemberDisplay";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/HealthCheckupsPage.css";
import "@/pages/HealthCheckupsOverviewPage.css";
import "@/components/consultation/ConsultationPatientBottomSheet.css";

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

function defaultSelection(rows: readonly GymMemberListRow[]): string[] {
  const primary = rows.find((r) => r.section === "self");
  if (primary) return [primary.id];
  return rows[0] ? [rows[0].id] : [];
}

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
  const rows = members;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (rows.length === 0) {
      setSelectedIds([]);
      return;
    }
    const id = selectedMemberId?.trim() ?? "";
    if (id && rows.some((r) => r.id === id)) {
      setSelectedIds([id]);
    } else {
      setSelectedIds(defaultSelection(rows));
    }
  }, [open, selectedMemberId, rows]);

  const selfMembers = useMemo(() => rows.filter((m) => m.section === "self"), [rows]);
  const familyMembersList = useMemo(() => rows.filter((m) => m.section === "family"), [rows]);

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

                <button
                  type="button"
                  className="hc-add-family"
                  onClick={() => {
                    onClose();
                    const returnTo = `${location.pathname}${location.search}`;
                    navigate(ROUTES.profileMembersAdd, { state: { returnTo } });
                  }}
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
          <button type="button" className="hc-continue" disabled={!canContinue} onClick={onContinue}>
            Continue
          </button>
        </footer>
      </div>
    </dialog>
  );
}
