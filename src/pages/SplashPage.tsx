import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import logoDark from "@/assets/images/logos/logo-dark.png";
import { SPLASH_SLIDES } from "@/constants/splashSlides";
import "./SplashPage.css";

const AUTO_ADVANCE_MS = 4500;
const SWIPE_THRESHOLD_PX = 48;

export function SplashPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const n = SPLASH_SLIDES.length;
  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % n);
  }, [n]);
  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);

  useEffect(() => {
    const t = globalThis.setInterval(goNext, AUTO_ADVANCE_MS);
    return () => globalThis.clearInterval(t);
  }, [goNext]);

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

  const slide = SPLASH_SLIDES[index];

  return (
    <main className="page splash-page">
      <header className="splash-page__brand">
        <img
          className="splash-page__logo"
          src={logoDark}
          alt="OPD Mobile"
          decoding="async"
        />
      </header>

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
          {SPLASH_SLIDES.map((s) => (
            <div key={s.title} className="splash-page__slide">
              <img
                className="splash-page__illustration"
                src={s.image}
                alt=""
                draggable={false}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="splash-page__copy">
        <h1 className="splash-page__title">{slide.title}</h1>
        <p className="splash-page__subtitle">{slide.subtitle}</p>
      </div>

      <div className="splash-page__dots" role="tablist" aria-label="Slide">
        {SPLASH_SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={`splash-page__dot${i === index ? " splash-page__dot--active" : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

      <div className="splash-page__footer">
        <button
          type="button"
          className="splash-page__cta"
          onClick={() => navigate(ROUTES.login)}
        >
          <span className="splash-page__cta-label">Get Started</span>
          <span className="splash-page__cta-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>
    </main>
  );
}
