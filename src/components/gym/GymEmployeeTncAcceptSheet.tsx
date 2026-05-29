import { useCallback, useEffect, useRef, useState } from "react";
import "./GymEmployeeTncAcceptSheet.css";

type GymEmployeeTncAcceptSheetProps = Readonly<{
  open: boolean;
  tncHtml: string;
  onClose: () => void;
  onAccept: () => void;
}>;

const SCROLL_END_THRESHOLD_PX = 32;

export function GymEmployeeTncAcceptSheet({
  open,
  tncHtml,
  onClose,
  onAccept,
}: GymEmployeeTncAcceptSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 8) {
      setReachedEnd(true);
      return;
    }
    if (scrollTop >= maxScroll - SCROLL_END_THRESHOLD_PX) {
      setReachedEnd(true);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setReachedEnd(false);
      return;
    }
    const id = requestAnimationFrame(() => checkScrollEnd());
    return () => cancelAnimationFrame(id);
  }, [open, tncHtml, checkScrollEnd]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="getas-root" role="dialog" aria-modal="true" aria-labelledby="getas-title">
      <button type="button" className="getas-backdrop" aria-label="Close" onClick={onClose} />
      <div className="getas-sheet">
        <div className="getas-handle" aria-hidden />
        <header className="getas-header">
          <h2 id="getas-title" className="getas-title">
            Terms &amp; conditions
          </h2>
          <button type="button" className="getas-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p
          className={`getas-hint${reachedEnd ? " getas-hint--ok" : " getas-hint--warn"}`}
          role="status"
        >
          {reachedEnd
            ? "You reached the end. Tap I accept to continue."
            : "Scroll to the end to enable I accept."}
        </p>
        <div
          ref={scrollRef}
          className="getas-scroll"
          tabIndex={0}
          onScroll={checkScrollEnd}
        >
          <div
            className="getas-html"
            dangerouslySetInnerHTML={{ __html: tncHtml }}
          />
        </div>
        <footer className="getas-footer">
          <button
            type="button"
            className="getas-accept"
            disabled={!reachedEnd}
            onClick={() => {
              onAccept();
              onClose();
            }}
          >
            I accept
          </button>
        </footer>
      </div>
    </div>
  );
}
