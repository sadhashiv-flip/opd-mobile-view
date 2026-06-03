import { MobileFilterSheet } from "@/components/mobileFilter/MobileFilterSheet";
import { MedicalRecordSlugIcon } from "@/components/medicalRecords/MedicalRecordsIcons";
import type { MemberDisplay } from "@/api/patientMember";
import {
  activeMedicalRecordFilterLabel,
  HEALTH_LOG_GROUP_LABEL,
  MEDICAL_RECORD_HEALTH_LOG_CATEGORIES,
  MEDICAL_RECORD_PRIMARY_CATEGORIES,
  medicalRecordCategoryFromSlug,
  type MedicalRecordCategoryDef,
  isHealthLogMedicalRecordSlug,
} from "@/constants/medicalRecordsCategories";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MdOutlineFavoriteBorder } from "react-icons/md";
import "./MedicalRecordsCards.css";

function scrollStripSelectionToCenter(
  container: HTMLElement | null,
  selectedSelector: string,
  behavior: ScrollBehavior = "smooth",
) {
  if (!container) return;
  const active = container.querySelector(selectedSelector);
  if (active instanceof HTMLElement) {
    active.scrollIntoView({ inline: "center", block: "nearest", behavior });
  }
}

export type MedicalRecordsFilterApply = Readonly<{
  categorySlug: string;
  userFilterId: string;
}>;

export type MedicalRecordsFilterSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Applied category (from route). */
  category: MedicalRecordCategoryDef;
  /** Applied family filter. */
  userFilterId: string;
  members: readonly MemberDisplay[];
  membersLoading: boolean;
  onApply: (draft: MedicalRecordsFilterApply) => void;
}>;

export function MedicalRecordsFilterSheet({
  open,
  onClose,
  category,
  userFilterId,
  members,
  membersLoading,
  onApply,
}: MedicalRecordsFilterSheetProps) {
  const [draftSlug, setDraftSlug] = useState(category.slug);
  const [draftUserId, setDraftUserId] = useState(userFilterId);

  const draftCategory = useMemo(
    () => medicalRecordCategoryFromSlug(draftSlug) ?? category,
    [draftSlug, category],
  );

  const healthLogActive = isHealthLogMedicalRecordSlug(draftSlug);
  const healthLogPillsRef = useRef<HTMLDivElement>(null);
  const memberStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftSlug(category.slug);
    setDraftUserId(userFilterId);
  }, [open, category.slug, userFilterId]);

  useLayoutEffect(() => {
    if (!open) return;
    scrollStripSelectionToCenter(
      healthLogPillsRef.current,
      ".mr-health-log-pill--selected",
      "auto",
    );
  }, [open, draftSlug]);

  useLayoutEffect(() => {
    if (!open || membersLoading) return;
    scrollStripSelectionToCenter(
      memberStripRef.current,
      ".mr-member-chip--selected",
      "auto",
    );
  }, [open, draftUserId, membersLoading, members.length]);

  const selectDraftCategory = (slug: string) => {
    setDraftSlug(slug);
    requestAnimationFrame(() => {
      scrollStripSelectionToCenter(
        healthLogPillsRef.current,
        ".mr-health-log-pill--selected",
      );
    });
  };

  const selectDraftUser = (id: string) => {
    setDraftUserId(id);
    requestAnimationFrame(() => {
      scrollStripSelectionToCenter(memberStripRef.current, ".mr-member-chip--selected");
    });
  };

  const handleDone = () => {
    onApply({ categorySlug: draftSlug, userFilterId: draftUserId });
  };

  return (
    <MobileFilterSheet
      open={open}
      onClose={onClose}
      title="Filter records"
      subtitle={activeMedicalRecordFilterLabel(draftCategory)}
    >
      <div className="mobile-filter-sheet__divider" />
      <div className="mobile-filter-sheet__section-label">Services &amp; visits</div>
      <div className="mobile-filter-sheet__section">
        <div className="mr-filter-grid">
          {MEDICAL_RECORD_PRIMARY_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`mr-filter-grid-tile${draftSlug === c.slug ? " mr-filter-grid-tile--selected" : ""}`}
              onClick={() => selectDraftCategory(c.slug)}
            >
              <span className="mr-filter-grid-tile__icon">
                <MedicalRecordSlugIcon slug={c.slug} size={18} />
              </span>
              <span className="mr-filter-grid-tile__label">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mobile-filter-sheet__divider" />
      <div className="mobile-filter-sheet__section-label">Health log</div>
      <div className="mobile-filter-sheet__section">
        <div className={`mr-health-log-strip${healthLogActive ? " mr-health-log-strip--active" : ""}`}>
          <div className="mr-health-log-strip__head">
            <MdOutlineFavoriteBorder size={16} aria-hidden />
            {HEALTH_LOG_GROUP_LABEL}
          </div>
          <div ref={healthLogPillsRef} className="mr-health-log-pills hide-scrollbar">
            {MEDICAL_RECORD_HEALTH_LOG_CATEGORIES.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={`mr-health-log-pill${draftSlug === c.slug ? " mr-health-log-pill--selected" : ""}`}
                onClick={() => selectDraftCategory(c.slug)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mobile-filter-sheet__divider" />
      <div className="mobile-filter-sheet__section-label">Family member</div>
      <div className="mobile-filter-sheet__section">
        {membersLoading ? (
          <p className="mr-status">Loading…</p>
        ) : (
          <div ref={memberStripRef} className="mr-member-strip hide-scrollbar">
            <button
              type="button"
              className={`mr-member-chip${draftUserId.trim().length === 0 ? " mr-member-chip--selected" : ""}`}
              onClick={() => selectDraftUser("")}
            >
              <span className="mr-member-chip__avatar" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 20v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 20v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="mr-member-chip__label">All</span>
            </button>
            {members.map((m) => {
              const name = m.name.trim().length > 0 ? m.name.trim() : "Member";
              const initial = name.charAt(0).toUpperCase() || "?";
              const selected = draftUserId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`mr-member-chip${selected ? " mr-member-chip--selected" : ""}`}
                  onClick={() => selectDraftUser(m.id)}
                >
                  <span className="mr-member-chip__avatar" aria-hidden>
                    {initial}
                  </span>
                  <span className="mr-member-chip__label">{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button type="button" className="mr-filter-done" onClick={handleDone}>
        Done
      </button>
    </MobileFilterSheet>
  );
}
