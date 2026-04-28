import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./mobileFilterSheet.css";

type MobileFilterSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}>;

export function MobileFilterSheet({ open, onClose, title, subtitle, children }: MobileFilterSheetProps) {
  if (!open) return null;

  const sheet = (
    <div className="mobile-filter-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="mobile-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-filter-sheet-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mobile-filter-sheet__scroll">
          <div className="mobile-filter-sheet__handle-wrap">
            <div className="mobile-filter-sheet__handle" />
          </div>
          <div className="mobile-filter-sheet__header">
            <div className="mobile-filter-sheet__header-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h4.5M10 6h10M14 18h6M4 18h7M9 12h11M4 12h3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="9" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
                <circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
                <circle cx="7" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="mobile-filter-sheet__header-text">
              <h2 id="mobile-filter-sheet-title" className="mobile-filter-sheet__title">
                {title}
              </h2>
              <p className="mobile-filter-sheet__subtitle">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(sheet, document.body);
}

type MobileFilterChipProps = Readonly<{
  label: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
}>;

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MobileFilterChip({ label, icon, selected, onClick }: MobileFilterChipProps) {
  return (
    <button
      type="button"
      className={`mobile-filter-chip${selected ? " mobile-filter-chip--selected" : ""}`}
      onClick={onClick}
    >
      <span className="mobile-filter-chip__icon">{icon}</span>
      <span className="mobile-filter-chip__label">{label}</span>
      {selected ? (
        <span className="mobile-filter-chip__check">
          <CheckIcon />
        </span>
      ) : null}
    </button>
  );
}
