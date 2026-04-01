import type { ReactNode } from "react";

export type SortOptionId =
  | "relevance"
  | "distance"
  | "experience"
  | "feesLowHigh"
  | "feesHighLow";

export type SortOption = Readonly<{ id: SortOptionId; label: string }>;

export type SortSheetProps = Readonly<{
  open: boolean;
  value: SortOptionId;
  onChange: (next: SortOptionId) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options?: readonly SortOption[];
  icon?: ReactNode;
  confirmLabel?: string;
}>;

const DEFAULT_OPTIONS: readonly SortOption[] = [
  { id: "relevance", label: "Relevance" },
  { id: "distance", label: "Distance" },
  { id: "experience", label: "Experience" },
  { id: "feesLowHigh", label: "Consultation Fees(Low to High)" },
  { id: "feesHighLow", label: "Consultation Fees(High to Low)" },
] as const;

export function SortSheet({
  open,
  value,
  onChange,
  onClose,
  title = "Sort List",
  subtitle = "Sort list by-",
  options = DEFAULT_OPTIONS,
  icon,
  confirmLabel = "Confirm",
}: SortSheetProps) {
  if (!open) return null;

  return (
    <dialog className="sort-sheet-dialog" open aria-label={title}>
      <section className="sort-sheet">
        <header className="sort-sheet__header">
          <div className="sort-sheet__title">
            {icon ? (
              <span className="sort-sheet__ic" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            {title}
          </div>
          <button type="button" className="sort-sheet__close" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="sort-sheet__sub">{subtitle}</div>
        <div className="sort-sheet__list" role="radiogroup" aria-label={subtitle}>
          {options.map((o) => {
            const active = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                className={`sort-sheet__row${active ? " sort-sheet__row--active" : ""}`}
                role="radio"
                aria-checked={active}
                onClick={() => onChange(o.id)}
              >
                <span className={`sort-sheet__radio${active ? " sort-sheet__radio--active" : ""}`} aria-hidden="true" />
                {o.label}
              </button>
            );
          })}
        </div>

        <button type="button" className="sort-sheet__confirm" onClick={onClose}>
          {confirmLabel}
        </button>
      </section>
    </dialog>
  );
}

