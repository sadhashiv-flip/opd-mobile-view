import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { SPLASH_SLIDES } from "@/constants/splashSlides";
import { isOnboardingDone, setOnboardingDone } from "@/lib/onboardingStorage";
import "./SplashPage.css";

const SWIPE_THRESHOLD_PX = 48;

export function SplashPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slideCount = SPLASH_SLIDES.length;
  const isLastSlide = index === slideCount - 1;

  const finishOnboarding = useCallback(() => {
    setOnboardingDone(true);
    void navigate(ROUTES.login, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (isOnboardingDone()) {
      void navigate(ROUTES.login, { replace: true });
    }
  }, [navigate]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, slideCount - 1));
  }, [slideCount]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const onPrimaryAction = () => {
    if (isLastSlide) {
      finishOnboarding();
      return;
    }
    goNext();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_THRESHOLD_PX) goPrev();
    else if (dx < -SWIPE_THRESHOLD_PX) goNext();
  };

  return (
    <main className="page splash-page">
      <div className="splash-page__skip-wrap">
        <button type="button" className="splash-page__skip" onClick={finishOnboarding}>
          Skip
        </button>
      </div>

      <section
        className="splash-page__carousel"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
        aria-label="App introduction"
      >
        <div
          className="splash-page__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SPLASH_SLIDES.map((slide) => (
            <article key={slide.title} className="splash-page__slide">
              <div className="splash-page__art">
                <img
                  className="splash-page__illustration"
                  src={slide.image}
                  alt=""
                  draggable={false}
                />
              </div>
              <div className="splash-page__copy">
                <h1 className="splash-page__title">{slide.title}</h1>
                <p className="splash-page__subtitle">{slide.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="splash-page__bottom">
        <div className="splash-page__dots" role="tablist" aria-label="Slide">
          {SPLASH_SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${slide.title}`}
              className={`splash-page__dot${i === index ? " splash-page__dot--active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <button type="button" className="splash-page__cta" onClick={onPrimaryAction}>
          <span className="splash-page__cta-label">{isLastSlide ? "Get Started" : "Next"}</span>
          <svg
            className="splash-page__cta-arrow"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </main>
  );
}
