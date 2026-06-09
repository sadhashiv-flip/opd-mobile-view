import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./OrderDetailCancellationReason.css";

export type OrderDetailCancellationReasonProps = Readonly<{
  reason: string;
  /** `banner` — under status banner; `inline` — status card; `lab` — lab sub-order card */
  variant?: "banner" | "inline" | "lab";
  title?: string;
}>;

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.29 6.71a.996.996 0 0 0 0 1.41L13.17 12l-3.88 3.88a.996.996 0 1 0 1.41 1.41l4.59-4.59a.996.996 0 0 0 0-1.41L10.7 6.7a.996.996 0 0 0-1.41.04z" />
    </svg>
  );
}

type CancellationReasonSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
}>;

function CancellationReasonSheet({ open, onClose, title, message }: CancellationReasonSheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const dialog = (
    <dialog
      className="od-cr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="od-cr-sheet">
        <header className="od-cr-sheet__header">
          <h2 id={titleId} className="od-cr-sheet__title">
            {title}
          </h2>
          <button type="button" className="od-cr-sheet__close" aria-label="Close" onClick={onClose}>
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
        <div className="od-cr-sheet__body">
          <p className="od-cr-sheet__message">{message}</p>
        </div>
      </section>
    </dialog>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}

function useTwoLineOverflow(text: string, variant: OrderDetailCancellationReasonProps["variant"]) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);

  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    setOverflow(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = textRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, text, variant]);

  return { textRef, overflow };
}

/**
 * patient_app `CancellationReasonSection` — cancellation note on order detail.
 */
export function OrderDetailCancellationReason({
  reason,
  variant = "banner",
  title = "Cancellation reason",
}: OrderDetailCancellationReasonProps) {
  const text = reason.trim();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { textRef, overflow } = useTwoLineOverflow(text, variant);

  if (!text) return null;

  const viewMoreButton = overflow ? (
    <button
      type="button"
      className="od-cancel-reason__view-more"
      onClick={() => setSheetOpen(true)}
    >
      View more
      <ChevronRightIcon />
    </button>
  ) : null;

  const sheet = (
    <CancellationReasonSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title={title}
      message={text}
    />
  );

  if (variant === "lab") {
    return (
      <>
        <div className="od-lab-sub-card__cancel-reason">
          <span className="od-lab-sub-card__cancel-reason-label">{title}</span>
          <p
            ref={textRef}
            className="od-lab-sub-card__cancel-reason-text od-cancel-reason__text--clamped"
          >
            {text}
          </p>
          {viewMoreButton}
        </div>
        {sheet}
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <p className="od-sr-status__cancel-label">{title}</p>
        <p ref={textRef} className="od-sr-status__cancel-text od-cancel-reason__text--clamped">
          {text}
        </p>
        {viewMoreButton}
        {sheet}
      </>
    );
  }

  return (
    <>
      <div className="od-banner__cancel-reason-block">
        <p className="od-banner__cancel-reason-label">{title}</p>
        <p ref={textRef} className="od-banner__cancel-reason od-cancel-reason__text--clamped">
          {text}
        </p>
        {viewMoreButton}
      </div>
      {sheet}
    </>
  );
}
