import type { SelectPeopleHint } from "@/lib/selectPeopleShared";

export function SelectPeopleSelectionHint({ hint }: Readonly<{ hint: SelectPeopleHint | null }>) {
  if (!hint) return null;
  return (
    <div
      className={`hc-selection-hint${hint.sponsored ? " hc-selection-hint--sponsored" : ""}`}
      role="note"
    >
      <span className="hc-selection-hint__ic" aria-hidden>
        {hint.sponsored ? "✓" : "i"}
      </span>
      <p className="hc-selection-hint__text">{hint.text}</p>
    </div>
  );
}
