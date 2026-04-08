import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { ROUTES } from "@/constants";
import {
  buildConsultMemberSnapshotFromRow,
  CONSULT_SELECTED_PERSON_KEY,
  writeConsultSelectedMembersSnapshots,
  writeConsultSelectedPersonIds,
} from "@/constants/consultationSelectedMemberStorage";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import selectSvg from "@/assets/icons/Dashboard/Select.svg";
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

function defaultSelection(rows: GymMemberListRow[]): string[] {
  const primary = rows.find((r) => r.section === "self");
  if (primary) return [primary.id];
  return rows[0] ? [rows[0].id] : [];
}

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
  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const maxSelectable = 1;

  const loadMembers = useCallback(async () => {
    const list = await fetchAllPatientMembers();
    setRows(patientMembersToGymRows(list));
  }, []);

  useEffect(() => {
    if (!open) return;
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
  }, [open, toast]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => rows.some((r) => r.id === id));
      if (next.length === 0) {
        const stored = readStoredPersonId();
        if (stored && rows.some((r) => r.id === stored)) {
          next = [stored];
        } else {
          next = defaultSelection(rows);
        }
      }
      if (next.length > maxSelectable) next = next.slice(0, maxSelectable);
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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

                <button
                  type="button"
                  className="hc-add-family"
                  onClick={() => {
                    onClose();
                    navigate(ROUTES.profileMembersAdd, {
                      state: { returnPath: `${location.pathname}${location.search}` },
                    });
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
