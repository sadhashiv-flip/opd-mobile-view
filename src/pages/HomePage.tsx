import {
  HomeChevronDownIcon,
  HomeLocationPinIcon,
  HomeProfileIcon,
  HomeVoiceRecordIcon,
  HomeSearchIcon,
  HomeWalletIcon,
} from "@/assets/icons/react";
import atCenterSvg from "@/assets/icons/Dashboard/AtCenter.svg";
import wpfOnlineSvg from "@/assets/icons/Dashboard/wpf_online.svg";
import healthCheckupSvg from "@/assets/icons/Dashboard/HealthCheckup.svg";
import labTestsSvg from "@/assets/icons/Dashboard/LabTests.svg";
import atHospitalSvg from "@/assets/icons/Dashboard/AtHospital.svg";
import virtualSvg from "@/assets/icons/Dashboard/Virtual.svg";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import { HOME_BANNER_SLIDES, HOME_IMAGE_URLS, ROUTES } from "@/constants";
import { useHomeBannerCarousel } from "@/hooks/useHomeBannerCarousel";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";
import "./ServicesHubPage.css";

export function HomePage() {
  const navigate = useNavigate();
  const bannerCount = HOME_BANNER_SLIDES.length;
  const {
    activeIndex: activeBanner,
    goTo: goToBanner,
    onTouchStart: onBannerTouchStart,
    onTouchEnd: onBannerTouchEnd,
  } = useHomeBannerCarousel({ slideCount: bannerCount });

  const [isDiagnosticsSheetOpen, setIsDiagnosticsSheetOpen] = useState(false);
  const [isConsultationSheetOpen, setIsConsultationSheetOpen] = useState(false);

  useEffect(() => {
    const isAnySheetOpen = isDiagnosticsSheetOpen || isConsultationSheetOpen;
    if (!isAnySheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isDiagnosticsSheetOpen, isConsultationSheetOpen]);

  return (
    <div className="home-page">
      <main className="home-page__main">
        <header className="home-top">
          <div className="home-location">
            <span className="home-location__pin" aria-hidden="true">
              <HomeLocationPinIcon />
            </span>
            <div className="home-location__text">
              <button type="button" className="home-location__title">
                Home
                <HomeChevronDownIcon
                  className="home-location__chev"
                  aria-hidden="true"
                />
              </button>
              <p className="home-location__addr">
                Street, 7th floor, Building A…
              </p>
            </div>
          </div>
          <div className="home-top__actions">
            <button type="button" className="home-icon-btn" aria-label="Wallet">
              <HomeWalletIcon />
            </button>
            <button
              type="button"
              className="home-icon-btn home-icon-btn--round"
              aria-label="Profile"
              onClick={() => navigate(ROUTES.profile)}
            >
              <HomeProfileIcon />
            </button>
          </div>
        </header>

        <div className="home-search">
          <span className="home-search__search-ic" aria-hidden="true">
            <HomeSearchIcon />
          </span>
          <input
            type="search"
            className="home-search__input"
            placeholder="Search for Pharmacy"
            aria-label="Search for Pharmacy"
          />
          <span className="home-search__divider" aria-hidden="true" />
          <button type="button" className="home-search__mic" aria-label="Voice search">
            <HomeVoiceRecordIcon />
          </button>
        </div>

        <section className="home-section" aria-labelledby="services-heading">
          <h2 id="services-heading" className="visually-hidden">
            Medical services
          </h2>

          <button
            type="button"
            className="home-card home-card--featured home-card--clickable home-card--btn"
            aria-label="Open Diagnostics options"
            onClick={() => setIsDiagnosticsSheetOpen(true)}
          >
            <div className="home-card__body">
              <h3 className="home-card__title">Diagnostics</h3>
              <div className="home-card__slot-row">
                <span className="home-card__slot-ic" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M12 8v4l3 1.5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="home-card__slot-text">SAME DAY SLOT BOOKING</span>
              </div>
              <div className="home-card__loc-row">
                <span className="home-card__loc-item">
                  <span className="home-card__loc-ic home-card__loc-ic--blue" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  home collection
                </span>
                <span className="home-card__loc-sep" aria-hidden="true">
                  ·
                </span>
                <span className="home-card__loc-item">
                  <span className="home-card__loc-ic home-card__loc-ic--brand" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 22V12l6-3 6 3v10M9 22v-5h6v5M10 9h.01M14 9h.01"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  at center
                </span>
              </div>
              <span className="home-badge home-badge--soft">UP TO 20% OFF</span>
            </div>
            <div
              className="home-card__media home-card__media--lg"
              style={{ backgroundImage: `url(${HOME_IMAGE_URLS.diagnostics})` }}
            />
          </button>

          <div className="home-grid-wrap">
            <div className="home-grid">
              <button
                type="button"
                className="home-card home-card--tile home-card--tile-consult home-card--btn home-card--clickable"
                aria-label="Open Consultation options"
                onClick={() => setIsConsultationSheetOpen(true)}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title">Consultation</h3>
                  <p className="home-card__meta">INSTANT APPOINTMENT</p>
                  <div className="home-card__loc-row home-card__loc-row--tile">
                    <span className="home-card__loc-item">
                      <span className="home-card__loc-ic" aria-hidden="true">
                        <img
                          src={wpfOnlineSvg}
                          alt=""
                          className="home-card__loc-img"
                          width={14}
                          height={14}
                          draggable={false}
                        />
                      </span>
                      virtual
                    </span>
                    <span className="home-card__loc-sep" aria-hidden="true">
                      ·
                    </span>
                    <span className="home-card__loc-item">
                      <span className="home-card__loc-ic" aria-hidden="true">
                        <img
                          src={atCenterSvg}
                          alt=""
                          className="home-card__loc-img"
                          width={14}
                          height={14}
                          draggable={false}
                        />
                      </span>
                      at center
                    </span>
                  </div>
                  <span className="home-badge home-badge--bolt">
                    <svg
                      className="home-badge__bolt-ic"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                        fill="currentColor"
                      />
                    </svg>
                    10 MINS
                  </span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: `url(${HOME_IMAGE_URLS.consultation})` }}
                />
              </button>
              <button
                type="button"
                className="home-card home-card--tile home-card--btn home-card--clickable"
                aria-label="Open Dental"
                onClick={() => navigate(ROUTES.dental)}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title">Dental</h3>
                  <p className="home-card__meta">LOREM IPSUM</p>
                  <span className="home-badge home-badge--sm">UP TO 30% OFF</span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: `url(${HOME_IMAGE_URLS.dental})` }}
                />
              </button>
              <button
                type="button"
                className="home-card home-card--tile home-card--btn home-card--clickable"
                aria-label="Open Vision"
                onClick={() => navigate(ROUTES.vision)}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title">Vision</h3>
                  <span className="home-badge home-badge--sm">UP TO 30% OFF</span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: `url(${HOME_IMAGE_URLS.vision})` }}
                />
              </button>
              <button
                type="button"
                className="home-card home-card--tile home-card--btn home-card--clickable"
                aria-label="Open Pharmacy"
                onClick={() => navigate(ROUTES.pharmacy)}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title home-card__title--lower">pharmacy</h3>
                  <span className="home-badge home-badge--sm">UP TO 30% OFF</span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: `url(${HOME_IMAGE_URLS.pharmacy})` }}
                />
              </button>
            </div>
          </div>

          <Link to={ROUTES.services} className="home-view-more">
            VIEW MORE
          </Link>
        </section>

        <section
          className="home-banner"
          aria-label="Promotions"
          aria-roledescription="carousel"
        >
          <div
            className="home-banner__viewport"
            onTouchStart={onBannerTouchStart}
            onTouchEnd={onBannerTouchEnd}
          >
            <div
              className="home-banner__track"
              style={{
                width: `${bannerCount * 100}%`,
                transform: `translateX(-${(activeBanner * 100) / bannerCount}%)`,
              }}
            >
              {HOME_BANNER_SLIDES.map((slide, index) => (
                <div
                  key={slide.id}
                  className="home-banner__slide"
                  style={{ flex: `0 0 ${100 / bannerCount}%` }}
                  aria-hidden={index !== activeBanner}
                >
                  <div
                    className="home-banner__bg"
                    style={{ backgroundImage: `url(${slide.image})` }}
                  />
                  <div
                    className={`home-banner__overlay home-banner__overlay--${slide.overlay}`}
                  />
                  <div className="home-banner__content">
                    <div className="home-banner__text">
                      <h3 className="home-banner__title">{slide.title}</h3>
                      <p className="home-banner__date">{slide.date}</p>
                    </div>
                    <button type="button" className="home-banner__join">
                      {slide.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            className="home-banner__dots"
            role="tablist"
            aria-label="Choose promotion slide"
          >
            {HOME_BANNER_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === activeBanner}
                aria-label={`${slide.title}, slide ${index + 1} of ${bannerCount}`}
                className={`home-banner__dot${index === activeBanner ? " home-banner__dot--active" : ""}`}
                onClick={() => goToBanner(index)}
              />
            ))}
          </div>
        </section>
      </main>

      {isDiagnosticsSheetOpen ? (
        <dialog
          className="home-sheet-dialog"
          open
          aria-label="Diagnostics"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDiagnosticsSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsDiagnosticsSheetOpen(false);
          }}
        >
          <section className="home-sheet">
            <header className="home-sheet__header">
              <h3 className="home-sheet__title">Diagnostics</h3>
              <button
                type="button"
                className="home-sheet__close"
                aria-label="Close"
                onClick={() => setIsDiagnosticsSheetOpen(false)}
              >
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

            <div className="service-hub-grid service-hub-grid--cols-2">
              <ServiceHubCard
                icon={
                  <img
                    src={healthCheckupSvg}
                    alt=""
                    width={22}
                    height={22}
                    draggable={false}
                    className="service-hub-card__img-icon"
                  />
                }
                title="Health Checkups"
                description="Avail Free Health Checkups"
                onClick={() => {
                  setIsDiagnosticsSheetOpen(false);
                  navigate("/Diagnostics/health-checkups");
                }}
              />
              <ServiceHubCard
                icon={
                  <img
                    src={labTestsSvg}
                    alt=""
                    width={22}
                    height={22}
                    draggable={false}
                    className="service-hub-card__img-icon"
                  />
                }
                title="Lab Tests"
                description="Fully sponsored"
                onClick={() => {
                  setIsDiagnosticsSheetOpen(false);
                  navigate("/Diagnostics/lab-tests");
                }}
              />
            </div>
          </section>
        </dialog>
      ) : null}

      {isConsultationSheetOpen ? (
        <dialog
          className="home-sheet-dialog"
          open
          aria-label="Consultation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConsultationSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsConsultationSheetOpen(false);
          }}
        >
          <section className="home-sheet">
            <header className="home-sheet__header">
              <h3 className="home-sheet__title">Consultation</h3>
              <button
                type="button"
                className="home-sheet__close"
                aria-label="Close"
                onClick={() => setIsConsultationSheetOpen(false)}
              >
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

            <div className="service-hub-grid service-hub-grid--cols-2">
              <ServiceHubCard
                icon={
                  <img
                    src={atHospitalSvg}
                    alt=""
                    width={22}
                    height={22}
                    draggable={false}
                    className="service-hub-card__img-icon"
                  />
                }
                title="At Hospital"
                description="Book Your OPD Consultations Here"
                onClick={() => {
                  setIsConsultationSheetOpen(false);
                  navigate("/consultation/at_hospital");
                }}
              />
              <ServiceHubCard
                icon={
                  <img
                    src={virtualSvg}
                    alt=""
                    width={22}
                    height={22}
                    draggable={false}
                    className="service-hub-card__img-icon"
                  />
                }
                title="Virtual"
                description="Connecting Care, Virtually Everywhere"
                onClick={() => {
                  setIsConsultationSheetOpen(false);
                  navigate("/consultation/virtual");
                }}
              />
            </div>
          </section>
        </dialog>
      ) : null}

      <HomeBottomNav />
    </div>
  );
}
