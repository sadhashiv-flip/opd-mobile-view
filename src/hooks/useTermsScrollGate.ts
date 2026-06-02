import { useCallback, useEffect, useRef, useState } from "react";

/** Minimum scroll depth (0–1) before terms “Continue” is enabled — matches patient-app ~90%. */
const SCROLL_RATIO = 0.9;
/** Content fits without scrolling. */
const NO_SCROLL_MAX_PX = 8;
/** Near-bottom tolerance (patient-app uses ~28px). */
const END_THRESHOLD_PX = 28;

/**
 * Enables a footer action only after the user scrolls terms to the end,
 * or when the content does not require scrolling.
 */
export function useTermsScrollGate(active: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= NO_SCROLL_MAX_PX) {
      setScrolledToEnd(true);
      return;
    }
    const ratio = maxScroll > 0 ? scrollTop / maxScroll : 1;
    if (ratio >= SCROLL_RATIO || scrollTop >= maxScroll - END_THRESHOLD_PX) {
      setScrolledToEnd(true);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setScrolledToEnd(false);
      return;
    }
    const id = requestAnimationFrame(() => checkScroll());
    return () => cancelAnimationFrame(id);
  }, [active, checkScroll]);

  return { scrollRef, scrolledToEnd, onScroll: checkScroll };
}
