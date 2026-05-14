import { useMemo } from "react";
import ahcPromoUrl from "@/assets/images/dashboard-patient-app/ahc_card_dashboard.png?url";
import gymPromoUrl from "@/assets/images/dashboard-patient-app/gym_card_dashboard.png?url";
import { useHomeBannerCarousel } from "@/hooks/useHomeBannerCarousel";
import { cssBackgroundUrl } from "@/lib/cssBackgroundUrl";
import "./HomePromoCarousel.css";

export type HomePromoCarouselProps = Readonly<{
  showAhc: boolean;
  onAhcClick: () => void;
  onGymClick: () => void;
}>;

type PromoSlide = Readonly<{
  key: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  onClick: () => void;
}>;

/** Patient-app `DashboardPromoCarousel` — full-width photo promos, gradient, Explore CTA, 4s autoplay when 2 slides. */
export function HomePromoCarousel({ showAhc, onAhcClick, onGymClick }: HomePromoCarouselProps) {
  const slides = useMemo<PromoSlide[]>(() => {
    const out: PromoSlide[] = [];
    if (showAhc) {
      out.push({
        key: "ahc",
        title: "Annual Health Checkup",
        subtitle: "Get an annual health checkup",
        imageUrl: ahcPromoUrl,
        onClick: onAhcClick,
      });
    }
    out.push({
      key: "gym",
      title: "Gym Membership",
      subtitle: "Buy Gym memberships",
      imageUrl: gymPromoUrl,
      onClick: onGymClick,
    });
    return out;
  }, [showAhc, onAhcClick, onGymClick]);

  const slideCount = slides.length;
  const {
    activeIndex,
    extendedPos,
    extendedCount,
    translatePercent,
    instantMove,
    goTo,
    onTouchStart,
    onTouchEnd,
    onTrackTransitionEnd,
  } = useHomeBannerCarousel({ slideCount, autoAdvanceMs: 4000 });

  const extendedSlides = useMemo(() => {
    if (slides.length <= 1) {
      return slides.map((s) => ({ key: s.key, slide: s }));
    }
    const first = slides[0];
    const last = slides.at(-1);
    if (!first || !last) {
      return slides.map((s) => ({ key: s.key, slide: s }));
    }
    return [
      { key: `promo-clone-prev-${last.key}`, slide: last },
      ...slides.map((s) => ({ key: s.key, slide: s })),
      { key: `promo-clone-next-${first.key}`, slide: first },
    ];
  }, [slides]);

  if (slideCount === 0) return null;

  return (
    <section
      className="home-promo-carousel"
      aria-label="Featured programs"
      aria-roledescription="carousel"
    >
      <div
        className="home-promo-carousel__viewport"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={`home-promo-carousel__track${instantMove ? " home-promo-carousel__track--instant" : ""}`}
          style={{
            width: `${extendedCount * 100}%`,
            transform: `translateX(${translatePercent}%)`,
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName !== "transform") return;
            onTrackTransitionEnd();
          }}
        >
          {extendedSlides.map(({ key, slide }, index) => (
            <div
              key={key}
              className="home-promo-carousel__slide"
              style={{ flex: `0 0 ${100 / extendedCount}%` }}
              aria-hidden={index !== extendedPos}
            >
              <button
                type="button"
                className="home-promo-carousel__hit"
                aria-label={`${slide.title} — ${slide.subtitle}`}
                onClick={slide.onClick}
              >
                <div
                  className="home-promo-carousel__bg"
                  style={{ backgroundImage: cssBackgroundUrl(slide.imageUrl) }}
                />
                <div className="home-promo-carousel__gradient" aria-hidden />
                <div className="home-promo-carousel__copy">
                  <h3 className="home-promo-carousel__title">{slide.title}</h3>
                  <p className="home-promo-carousel__subtitle">{slide.subtitle}</p>
                  <span className="home-promo-carousel__cta">Explore</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
      {slideCount > 1 ? (
        <div className="home-promo-carousel__dots" role="tablist" aria-label="Choose promo slide">
          {slides.map((s, index) => (
            <button
              key={`promo-dot-${s.key}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`${s.title}, slide ${index + 1} of ${slideCount}`}
              className={`home-promo-carousel__dot${index === activeIndex ? " home-promo-carousel__dot--active" : ""}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
