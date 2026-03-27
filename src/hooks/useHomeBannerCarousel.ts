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

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex((index + slideCount * 100) % slideCount);
    },
    [slideCount],
  );

  useEffect(() => {
    const id = globalThis.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slideCount);
    }, AUTO_ADVANCE_MS);
    return () => globalThis.clearInterval(id);
  }, [slideCount, activeIndex]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
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
