import { MobileFilterSheet } from "@/components/mobileFilter/MobileFilterSheet";
import { medicalRecordSlugIconSrc } from "@/components/mobileFilter/medicalRecordFilterIcons";
import type { MemberDisplay } from "@/api/patientMember";
import {
  activeMedicalRecordFilterLabel,
  HEALTH_LOG_GROUP_LABEL,
  MEDICAL_RECORD_HEALTH_LOG_CATEGORIES,
  MEDICAL_RECORD_PRIMARY_CATEGORIES,
  type MedicalRecordCategoryDef,
  isHealthLogMedicalRecordSlug,
} from "@/constants/medicalRecordsCategories";
import "./MedicalRecordsCards.css";

export type MedicalRecordsFilterSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  category: MedicalRecordCategoryDef;
  userFilterId: string;
  members: readonly MemberDisplay[];
  membersLoading: boolean;
  onSelectCategory: (slug: string) => void;
  onSelectUser: (userId: string) => void;
}>;

export function MedicalRecordsFilterSheet({
  open,
  onClose,
  category,
  userFilterId,
  members,
  membersLoading,
  onSelectCategory,
  onSelectUser,
}: MedicalRecordsFilterSheetProps) {
  const healthLogActive = isHealthLogMedicalRecordSlug(category.slug);

  return (
    <MobileFilterSheet
      open={open}
      onClose={onClose}
      title="Filter records"
      subtitle={activeMedicalRecordFilterLabel(category)}
    >
      <div className="mobile-filter-sheet__divider" />
      <div className="mobile-filter-sheet__section-label">Services &amp; visits</div>
      <div className="mobile-filter-sheet__section">
        <div className="mr-filter-grid">
          {MEDICAL_RECORD_PRIMARY_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`mr-filter-grid-tile${category.slug === c.slug ? " mr-filter-grid-tile--selected" : ""}`}
              onClick={() => onSelectCategory(c.slug)}
            >
              <span className="mr-filter-grid-tile__icon">
                <img src={medicalRecordSlugIconSrc(c.slug)} alt="" width={18} height={18} />
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke="currentColor"
                strokeWidth="1.75"
              />
            </svg>
            {HEALTH_LOG_GROUP_LABEL}
          </div>
          <div className="mr-health-log-pills">
            {MEDICAL_RECORD_HEALTH_LOG_CATEGORIES.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={`mr-health-log-pill${category.slug === c.slug ? " mr-health-log-pill--selected" : ""}`}
                onClick={() => onSelectCategory(c.slug)}
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
          <div className="mr-member-strip">
            <button
              type="button"
              className={`mr-member-chip${userFilterId.trim().length === 0 ? " mr-member-chip--selected" : ""}`}
              onClick={() => onSelectUser("")}
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
              const selected = userFilterId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`mr-member-chip${selected ? " mr-member-chip--selected" : ""}`}
                  disabled={!m.isSubscribed}
                  onClick={() => onSelectUser(m.id)}
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

      <button type="button" className="mr-filter-done" onClick={onClose}>
        Done
      </button>
    </MobileFilterSheet>
  );
}
