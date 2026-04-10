import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 45;

type UseHomeBannerCarouselOptions = Readonly<{
  slideCount: number;
}>;

/**
 * Carousel index, autoplay (timer resets on every slide change), dots, swipe.
 */
export function useHomeBannerCarousel({ slideCount }: UseHomeBannerCarouselOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setActiveIndex((i) => {
      if (slideCount <= 0) return 0;
      return Math.min(i, slideCount - 1);
    });
  }, [slideCount]);

  const goTo = useCallback(
    (index: number) => {
      if (slideCount <= 0) return;
      setActiveIndex((index + slideCount * 100) % slideCount);
    },
    [slideCount],
  );

  useEffect(() => {
    if (slideCount <= 0) return;
    const id = globalThis.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slideCount);
    }, AUTO_ADVANCE_MS);
    return () => globalThis.clearInterval(id);
  }, [slideCount]);

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
      if (dx < -SWIPE_THRESHOLD_PX) {
        setActiveIndex((i) => (i + 1) % slideCount);
      } else if (dx > SWIPE_THRESHOLD_PX) {
        setActiveIndex((i) => (i - 1 + slideCount) % slideCount);
      }
    },
    [slideCount],
  );

  return {
    activeIndex,
    goTo,
    onTouchStart,
    onTouchEnd,
  };
}
