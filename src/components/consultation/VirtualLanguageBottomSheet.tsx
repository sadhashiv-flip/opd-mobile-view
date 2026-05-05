import { useEffect } from "react";
import { createPortal } from "react-dom";
import { languageList } from "@/constants/consultationLanguages";
import "@/components/address/AddressBottomSheet.css";
import "./VirtualLanguageBottomSheet.css";

export type VirtualLanguageBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Selected specialty label — shown under the title for context. */
  issueTitle: string;
  language: string;
  onLanguageChange: (next: string) => void;
  onContinue: () => void;
  continueDisabled: boolean;
}>;

export function VirtualLanguageBottomSheet({
  open,
  onClose,
  issueTitle,
  language,
  onLanguageChange,
  onContinue,
  continueDisabled,
}: VirtualLanguageBottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  if (typeof document === "undefined") return null;

  const dialog = (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="virt-lang-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="addr-sheet virt-lang-sheet">
        <header className="addr-sheet__header">
          <h2 id="virt-lang-sheet-title" className="addr-sheet__title">
            Preferred language   {issueTitle.trim() ? (
          <p className="virt-lang-sheet__issue" aria-live="polite">
            {issueTitle.trim()}
          </p>
        ) : null}
          </h2>
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

      

      
        <div className="virt-lang-sheet__list-wrap">
          <ul className="virt-lang-sheet__list" role="listbox" aria-label="Languages">
            {languageList.map((lang) => {
              const selected = language === lang;
              return (
                <li key={lang} className="virt-lang-sheet__item">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`virt-lang-sheet__choice${selected ? " virt-lang-sheet__choice--selected" : ""}`}
                    onClick={() => onLanguageChange(lang)}
                  >
                    <span className="virt-lang-sheet__choice-label">{lang}</span>
                    {selected ? (
                      <span className="virt-lang-sheet__check" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M20 6L9 17l-5-5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="virt-lang-sheet__actions">
          <button
            type="button"
            className="virt-lang-sheet__continue"
            disabled={continueDisabled}
            onClick={() => {
              if (continueDisabled) return;
              onContinue();
            }}
          >
            Continue
          </button>
        </div>
      </section>
    </dialog>
  );

  return createPortal(dialog, document.body);
}
