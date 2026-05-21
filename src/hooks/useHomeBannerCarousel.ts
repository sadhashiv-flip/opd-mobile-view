import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_AUTO_ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 45;
const DRAG_ACTIVATE_PX = 8;
const WHEEL_DELTA_THRESHOLD = 48;
const WHEEL_COOLDOWN_MS = 380;

type UseHomeBannerCarouselOptions = Readonly<{
  slideCount: number;
  /**
   * Autoplay interval when `slideCount > 1`. Patient-app API banners use 6s;
   * `DashboardPromoCarousel` uses 4s.
   */
  autoAdvanceMs?: number;
}>;

function realIndexFromExtendedPos(pos: number, slideCount: number): number {
  if (slideCount <= 0) return 0;
  if (pos <= 0) return slideCount - 1;
  if (pos >= slideCount + 1) return 0;
  return pos - 1;
}

/**
 * Carousel index, autoplay (timer resets on slideCount change), dots, swipe.
 * When `slideCount > 1`, clones first/last slides for seamless infinite looping + animated slides.
 */
export function useHomeBannerCarousel({
  slideCount,
  autoAdvanceMs = DEFAULT_AUTO_ADVANCE_MS,
}: UseHomeBannerCarouselOptions) {
  const infinite = slideCount > 1;
  const extendedCount = infinite ? slideCount + 2 : Math.max(1, slideCount);

  const [extendedPos, setExtendedPos] = useState(() => (infinite ? 1 : 0));
  /** Disables transform transition for instant wrap after landing on a clone slide */
  const [instantMove, setInstantMove] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const pointerStartX = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerDragging = useRef(false);
  const suppressClickRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const extendedPosRef = useRef(extendedPos);
  extendedPosRef.current = extendedPos;

  useEffect(() => {
    if (slideCount <= 0) return;
    setExtendedPos(infinite ? 1 : 0);
    setInstantMove(false);
  }, [slideCount, infinite]);

  const activeIndex = useMemo(
    () => realIndexFromExtendedPos(extendedPos, slideCount),
    [extendedPos, slideCount],
  );

  const translatePercent = useMemo(() => {
    if (slideCount <= 0) return 0;
    return -(extendedPos * 100) / extendedCount;
  }, [extendedPos, extendedCount, slideCount]);

  const goTo = useCallback(
    (realIndex: number) => {
      if (slideCount <= 0) return;
      const target = ((realIndex % slideCount) + slideCount) % slideCount;
      if (!infinite) {
        setExtendedPos(target);
        return;
      }
      setExtendedPos(target + 1);
    },
    [slideCount, infinite],
  );

  const stepNext = useCallback(() => {
    if (slideCount <= 0) return;
    if (!infinite) {
      setExtendedPos((p) => (p + 1) % slideCount);
      return;
    }
    setExtendedPos((p) => {
      if (p >= slideCount + 1) return 1;
      return p + 1;
    });
  }, [slideCount, infinite]);

  const stepPrev = useCallback(() => {
    if (slideCount <= 0) return;
    if (!infinite) {
      setExtendedPos((p) => (p - 1 + slideCount) % slideCount);
      return;
    }
    setExtendedPos((p) => {
      if (p <= 0) return slideCount;
      return p - 1;
    });
  }, [slideCount, infinite]);

  useEffect(() => {
    if (slideCount <= 1 || autoAdvanceMs <= 0) return;
    const id = globalThis.setInterval(() => {
      stepNext();
    }, autoAdvanceMs);
    return () => globalThis.clearInterval(id);
  }, [slideCount, stepNext, autoAdvanceMs]);

  const onTrackTransitionEnd = useCallback(() => {
    if (!infinite || slideCount <= 1) return;
    const p = extendedPosRef.current;
    if (p !== slideCount + 1 && p !== 0) return;
    setInstantMove(true);
    setExtendedPos(p === slideCount + 1 ? 1 : slideCount);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setInstantMove(false));
    });
  }, [infinite, slideCount]);

  const applySwipeDelta = useCallback(
    (dx: number) => {
      if (slideCount <= 1) return false;
      if (dx < -SWIPE_THRESHOLD_PX) {
        stepNext();
        return true;
      }
      if (dx > SWIPE_THRESHOLD_PX) {
        stepPrev();
        return true;
      }
      return false;
    },
    [slideCount, stepNext, stepPrev],
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (slideCount <= 0) return;
      if (touchStartX.current == null) return;
      const endX = e.changedTouches[0].clientX;
      const dx = endX - touchStartX.current;
      touchStartX.current = null;
      applySwipeDelta(dx);
    },
    [slideCount, applySwipeDelta],
  );

  const resetPointerDrag = useCallback(() => {
    pointerStartX.current = null;
    pointerIdRef.current = null;
    pointerDragging.current = false;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (slideCount <= 1 || e.button !== 0) return;
      pointerStartX.current = e.clientX;
      pointerIdRef.current = e.pointerId;
      pointerDragging.current = false;
      suppressClickRef.current = false;
    },
    [slideCount],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current == null || pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - pointerStartX.current;
    if (!pointerDragging.current && Math.abs(dx) >= DRAG_ACTIVATE_PX) {
      pointerDragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerStartX.current == null || pointerIdRef.current !== e.pointerId) return;
      const dx = e.clientX - pointerStartX.current;
      const wasDragging = pointerDragging.current;
      if (wasDragging) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
      resetPointerDrag();
      if (!wasDragging) return;
      if (applySwipeDelta(dx)) {
        suppressClickRef.current = true;
      }
    },
    [applySwipeDelta, resetPointerDrag],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      if (pointerDragging.current) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
      resetPointerDrag();
    },
    [resetPointerDrag],
  );

  const onViewportClickCapture = useCallback((e: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || slideCount <= 1) return;

    let wheelAccum = 0;
    let wheelLocked = false;
    let unlockTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const onWheelNative = (e: WheelEvent) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;

      if (wheelLocked) {
        e.preventDefault();
        return;
      }

      wheelAccum += delta;
      if (Math.abs(wheelAccum) < WHEEL_DELTA_THRESHOLD) return;

      e.preventDefault();
      wheelLocked = true;
      if (wheelAccum > 0) stepNext();
      else stepPrev();
      wheelAccum = 0;

      if (unlockTimer != null) globalThis.clearTimeout(unlockTimer);
      unlockTimer = globalThis.setTimeout(() => {
        wheelLocked = false;
        unlockTimer = null;
      }, WHEEL_COOLDOWN_MS);
    };

    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheelNative);
      if (unlockTimer != null) globalThis.clearTimeout(unlockTimer);
    };
  }, [slideCount, stepNext, stepPrev]);

  return {
    activeIndex,
    extendedPos,
    extendedCount,
    translatePercent,
    instantMove,
    goTo,
    stepNext,
    stepPrev,
    viewportRef,
    onTouchStart,
    onTouchEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onViewportClickCapture,
    onTrackTransitionEnd,
  };
}
