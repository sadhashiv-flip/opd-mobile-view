import { HomeNotificationIcon, HomeProfileIcon, HomeVoiceRecordIcon, HomeSearchIcon, HomeWalletIcon } from "@/assets/icons/react";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { useSelectedAddressLine, useSelectedAddressTag } from "@/hooks/useSelectedAddressLine";
import atCenterSvg from "@/assets/icons/Dashboard/AtCenter.svg";
import wpfOnlineSvg from "@/assets/icons/Dashboard/wpf_online.svg";
import healthCheckupSvg from "@/assets/icons/Dashboard/HealthCheckup.svg";
import labTestsSvg from "@/assets/icons/Dashboard/LabTests.svg";
import atHospitalSvg from "@/assets/icons/Dashboard/AtHospital.svg";
import virtualSvg from "@/assets/icons/Dashboard/Virtual.svg";
import { HealthClubSection } from "@/components/healthClub/HealthClubSection";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import { HOME_IMAGE_URLS, ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { cssBackgroundUrl } from "@/lib/cssBackgroundUrl";
import { orderDetailKindInUrlFromDashboardOngoing } from "@/lib/orderDetailRoutes";
import { useHomeBannerCarousel } from "@/hooks/useHomeBannerCarousel";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { generatePath, Link, useNavigate } from "react-router-dom";
import "./HomePage.css";
import "./DigitalDiaryPages.css";
import "./ServicesHubPage.css";

const PLACEHOLDER_ADDRESS = "Street, 7th floor, Building A…";

/** Status chip tint — mirrors Flutter `DashboardUpcomingOrdersSection._statusFg/_statusBg`. */
function ongoingStatusBadgeClass(label: string): string {
  const s = label.toLowerCase();
  if (s.includes("completed")) return "home-ongoing-dash-card__status--completed";
  if (s.includes("cancel") || s.includes("expired")) return "home-ongoing-dash-card__status--danger";
  if (s.includes("payment pending")) return "home-ongoing-dash-card__status--warning";
  if (s.includes("upcoming") || s.includes("session")) return "home-ongoing-dash-card__status--info";
  if (
    s.includes("pending") ||
    s.includes("processing") ||
    s.includes("progress") ||
    s.includes("waiting")
  ) {
    return "home-ongoing-dash-card__status--warning";
  }
  return "home-ongoing-dash-card__status--neutral";
}

/** Dots for slide counts 2–7; at 8+ use compact progress + prev/next (too many dots otherwise). */
const HOME_CAROUSEL_DOT_MAX = 7;

export function HomePage() {
  const navigate = useNavigate();
  const {
    apiBanners,
    ahcBanners,
    notificationCount,
    primaryAddressLine,
    ongoing,
    ahc,
  } = useHomeDashboard();
  const addressLine = useSelectedAddressLine(primaryAddressLine ?? PLACEHOLDER_ADDRESS);
  const addressTag = useSelectedAddressTag("HOME");
  const ongoingCount = ongoing.length;
  const apiBannerCount = apiBanners.length;
  const homeCarouselCount = apiBannerCount;
  const {
    activeIndex: activeHomeCarousel,
    goTo: goToHomeCarousel,
    onTouchStart: onHomeCarouselTouchStart,
    onTouchEnd: onHomeCarouselTouchEnd,
  } = useHomeBannerCarousel({ slideCount: homeCarouselCount });

  const [isDiagnosticsSheetOpen, setIsDiagnosticsSheetOpen] = useState(false);
  const [isConsultationSheetOpen, setIsConsultationSheetOpen] = useState(false);
  const [isVisionSheetOpen, setIsVisionSheetOpen] = useState(false);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const ongoingCarouselRef = useRef<HTMLDivElement>(null);
  const ahcBannerScrollRef = useRef<HTMLDivElement>(null);
  const ahcBannerSlideCount = ahcBanners.length;

  /** AHC banner strip: auto-advance when multiple API slides. */
  useEffect(() => {
    if (!ahc || ahcBannerSlideCount <= 1) return;
    const id = window.setInterval(() => {
      const el = ahcBannerScrollRef.current;
      if (!el) return;
      const slides = el.querySelectorAll<HTMLElement>("[data-ahc-banner-slide]");
      if (slides.length === 0) return;
      const gap = 12;
      const w = slides[0].offsetWidth;
      const cur = Math.max(0, Math.round(el.scrollLeft / Math.max(1, w + gap)));
      const next = (cur + 1) % slides.length;
      el.scrollTo({ left: next * (w + gap), behavior: "smooth" });
    }, 3000);
    return () => clearInterval(id);
  }, [ahc, ahcBannerSlideCount]);

  /** Match Flutter dashboard: auto-advance `PageView` every 3s. */
  useEffect(() => {
    if (ongoingCount <= 1) return;
    const id = window.setInterval(() => {
      const el = ongoingCarouselRef.current;
      if (!el) return;
      const slides = el.querySelectorAll<HTMLElement>("[data-ongoing-slide]");
      if (slides.length === 0) return;
      const gap = 12;
      const w = slides[0].offsetWidth;
      const cur = Math.max(
        0,
        Math.round(el.scrollLeft / Math.max(1, w + gap)),
      );
      const next = (cur + 1) % slides.length;
      el.scrollTo({ left: next * (w + gap), behavior: "smooth" });
    }, 3000);
    return () => clearInterval(id);
  }, [ongoingCount]);

  useEffect(() => {
    const isAnySheetOpen =
      isDiagnosticsSheetOpen || isConsultationSheetOpen || isVisionSheetOpen || addrSheetOpen;
    if (!isAnySheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isDiagnosticsSheetOpen, isConsultationSheetOpen, isVisionSheetOpen, addrSheetOpen]);

  let homeCarouselPagination: ReactNode = null;
  if (homeCarouselCount > 1) {
    if (homeCarouselCount <= HOME_CAROUSEL_DOT_MAX) {
      homeCarouselPagination = (
        <div
          className="home-banner__dots"
          role="tablist"
          aria-label="Choose slide"
        >
          {apiBanners.map((slide, index) => (
            <button
              key={`dot-banner-${slide.id ?? slide.image}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === activeHomeCarousel}
              aria-label={`Promotion, slide ${index + 1} of ${homeCarouselCount}`}
              className={`home-banner__dot${index === activeHomeCarousel ? " home-banner__dot--active" : ""}`}
              onClick={() => goToHomeCarousel(index)}
            />
          ))}
        </div>
      );
    } else {
      homeCarouselPagination = (
        <div className="home-banner__compact-nav" aria-label="Carousel position">
          <button
            type="button"
            className="home-banner__compact-nav-btn"
            aria-label="Previous slide"
            onClick={() => goToHomeCarousel(activeHomeCarousel - 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="home-banner__compact-nav-mid">
            <div className="home-banner__progress-track" aria-hidden>
              <div
                className="home-banner__progress-fill"
                style={{
                  width: `${((activeHomeCarousel + 1) / homeCarouselCount) * 100}%`,
                }}
              />
            </div>
            <p className="home-banner__slide-count" aria-live="polite">
              <span className="home-banner__slide-count-current">{activeHomeCarousel + 1}</span>
              <span className="home-banner__slide-count-sep" aria-hidden>
                {" / "}
              </span>
              <span className="home-banner__slide-count-total">{homeCarouselCount}</span>
            </p>
          </div>
          <button
            type="button"
            className="home-banner__compact-nav-btn"
            aria-label="Next slide"
            onClick={() => goToHomeCarousel(activeHomeCarousel + 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      );
    }
  }

  return (
    <div className="home-page">
      <div className="home-page__chrome">
        <header className="home-top">
          <button
            type="button"
            className="home-loc"
            aria-label="Choose address"
            onClick={() => setAddrSheetOpen(true)}
          >
            <span className="home-loc__pin" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                  fill="#FF541E"
                />
                <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
              </svg>
            </span>
            <div className="home-loc__body">
              <span className="home-loc__title">{addressTag}</span>
              <span className="home-loc__sep" aria-hidden="true">
                |
              </span>
              <span className="home-loc__addr">{addressLine}</span>
            </div>
            <span className="home-loc__chev" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          <div className="home-top__actions">
            <button
              type="button"
              className="home-icon-btn"
              aria-label="Wallet"
              onClick={() => navigate(ROUTES.wallet)}
            >
              <HomeWalletIcon />
            </button>
            <button
              type="button"
              className="home-icon-btn home-notif-btn"
              aria-label={
                notificationCount > 0
                  ? `Notifications, ${notificationCount} unread`
                  : "Notifications"
              }
              onClick={() => navigate(ROUTES.notifications)}
            >
              <HomeNotificationIcon className="home-notif-btn__icon" />
              {notificationCount > 0 ? (
                <span className="home-notif-btn__badge">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : null}
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

        <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />

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
      </div>

      <main className="home-page__main">
        {/* {gym?.gymModule ? (
          <div className="home-gym-row">
            <button
              type="button"
              className="home-dash-pill home-dash-pill--gym"
              onClick={() => navigate(ROUTES.gymMembership)}
            >
              {gym.packageName ? `Gym · ${gym.packageName}` : "Gym membership"}
            </button>
          </div>
        ) : null} */}

        <section className="home-section" aria-labelledby="services-heading">
          <h2 id="services-heading" className="visually-hidden">
            Medical services
          </h2>

          {homeCarouselCount > 0 ? (
            <section
              className={`home-banner home-banner--mixed${homeCarouselCount > HOME_CAROUSEL_DOT_MAX ? " home-banner--many-slides" : ""}`}
              aria-label="Promotional banners"
              aria-roledescription="carousel"
            >
              <div
                className="home-banner__viewport"
                onTouchStart={onHomeCarouselTouchStart}
                onTouchEnd={onHomeCarouselTouchEnd}
              >
                <div
                  className="home-banner__track"
                  style={{
                    width: `${homeCarouselCount * 100}%`,
                    transform: `translateX(-${(activeHomeCarousel * 100) / homeCarouselCount}%)`,
                  }}
                >
                  {apiBanners.map((slide, index) => (
                    <div
                      key={slide.id ?? `banner-${slide.image}-${index}`}
                      className="home-banner__slide home-banner__slide--api"
                      style={{ flex: `0 0 ${100 / homeCarouselCount}%` }}
                      aria-hidden={index !== activeHomeCarousel}
                    >
                      {slide.link ? (
                        <a
                          href={slide.link}
                          className="home-banner__api-hit"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open promotion"
                        >
                          <div
                            className="home-banner__bg"
                            style={{ backgroundImage: cssBackgroundUrl(slide.image) }}
                          />
                        </a>
                      ) : (
                        <div className="home-banner__api-hit">
                          <div
                            className="home-banner__bg"
                            style={{ backgroundImage: cssBackgroundUrl(slide.image) }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {homeCarouselPagination}
            </section>
          ) : null}

          {ahc ? (
            <button
              type="button"
              className="home-ahc-card"
              aria-label="Annual Health Checkup — Book your sponsored health checkup"
              onClick={() =>
                navigate(
                  `${generatePath(ROUTES.diagnosticsSelectPeople, {
                    type: "health-checkups",
                  })}?sponsored=1&ahc=1`,
                )
              }
            >
              <div className="home-ahc-card__stack">
                <div className="home-ahc-card__bg" aria-hidden>
                  {ahcBanners.length > 0 ? (
                    <div
                      className="home-ahc-card__banner-scroll"
                      ref={ahcBannerScrollRef}
                    >
                      {ahcBanners.map((slide, index) => (
                        <div
                          key={slide.id ?? `ahc-${slide.image}-${index}`}
                          className="home-ahc-card__banner-slide"
                          data-ahc-banner-slide
                          style={{
                            backgroundImage: cssBackgroundUrl(slide.image),
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="home-ahc-card__banner-slide home-ahc-card__banner-slide--fallback"
                      style={{
                        backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.diagnostics),
                      }}
                    />
                  )}
                </div>
                <div className="home-ahc-card__scrim" aria-hidden />
                <div className="home-ahc-card__content">
                  <div className="home-ahc-card__copy">
                    <h3 className="home-ahc-card__title">Annual Health Checkup</h3>
                    <p className="home-ahc-card__subtitle">Book your sponsored health checkup</p>
                  </div>
                  <span className="home-ahc-card__chev" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          ) : null}

          {ongoingCount > 0 ? (
            <section className="home-ongoing-section" aria-labelledby="ongoing-orders-heading">
              <div className="home-ongoing-section__header">
                <h2 id="ongoing-orders-heading" className="home-ongoing-section__title">
                  Ongoing orders
                </h2>
                <button
                  type="button"
                  className="home-ongoing-section__view-all"
                  onClick={() => navigate(ROUTES.orders)}
                >
                  View all
                </button>
              </div>
              <div className="home-ongoing-section__body">
                <div
                  className="home-ongoing-carousel"
                  ref={ongoingCarouselRef}
                  aria-label="Ongoing orders, swipe sideways"
                >
                  {ongoing.map((item) => (
                    <div
                      key={item.id}
                      className="home-ongoing-carousel__slide"
                      data-ongoing-slide
                    >
                      <div className="home-ongoing-dash-card">
                        <button
                          type="button"
                          className="home-ongoing-dash-card__main"
                          onClick={() =>
                            navigate(
                              generatePath(ROUTES.ordersDetail, {
                                orderKind: orderDetailKindInUrlFromDashboardOngoing(item),
                                invoiceId: item.invoiceId,
                              }),
                            )
                          }
                        >
                          <span className="home-ongoing-dash-card__icon-wrap" aria-hidden>
                            <OrderCategoryIcon
                              categoryKey={item.orderCategoryIconKey}
                              width={18}
                              height={18}
                            />
                          </span>
                          <span className="home-ongoing-dash-card__content">
                            <span className="home-ongoing-dash-card__row1">
                              <span className="home-ongoing-dash-card__category">
                                {item.displayCategory}
                              </span>
                              <span
                                className={`home-ongoing-dash-card__status ${ongoingStatusBadgeClass(item.statusLabel)}`}
                              >
                                {item.statusLabel}
                              </span>
                            </span>
                            <span className="home-ongoing-dash-card__row2">
                              <span className="home-ongoing-dash-card__patient">
                                {item.patientLine}
                              </span>
                              {item.memberCount > 1 ? (
                                <span className="home-ongoing-dash-card__members">
                                  +{item.memberCount - 1} members
                                </span>
                              ) : null}
                            </span>
                            <span className="home-ongoing-dash-card__when">{item.whenLine}</span>
                            {item.visitTypeLabel ? (
                              <span className="home-ongoing-dash-card__visit-type">
                                {item.visitTypeLabel}
                              </span>
                            ) : null}
                          </span>
                          <span className="home-ongoing-dash-card__chev" aria-hidden>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M9 6l6 6-6 6"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </button>
                        {item.canJoinVideoCall ? (
                          <button
                            type="button"
                            className="home-ongoing-dash-card__join-call"
                            onClick={() =>
                              navigate(
                                generatePath(ROUTES.videoCall, { appointmentId: item.id }),
                              )
                            }
                          >
                            Join video call
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {ongoingCount > 1 ? (
                  <button
                    type="button"
                    className="home-ongoing-more-link"
                    onClick={() => navigate(ROUTES.orders)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    +{ongoingCount - 1} more ongoing
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

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
              style={{ backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.diagnostics) }}
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
                  style={{ backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.consultation) }}
                />
              </button>
              <button
                type="button"
                className="home-card home-card--tile home-card--btn home-card--clickable"
                aria-label="Open Dental"
                onClick={() => navigate(ROUTES.dentalSelectPeople)}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title">Dental</h3>
                  <p className="home-card__meta">LOREM IPSUM</p>
                  <span className="home-badge home-badge--sm">UP TO 30% OFF</span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.dental) }}
                />
              </button>
              <button
                type="button"
                className="home-card home-card--tile home-card--btn home-card--clickable"
                aria-label="Open Vision options"
                onClick={() => setIsVisionSheetOpen(true)}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title">Vision</h3>
                  <span className="home-badge home-badge--sm">UP TO 30% OFF</span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.vision) }}
                />
              </button>
              <button
                type="button"
                className="home-card home-card--tile home-card--btn home-card--clickable"
                aria-label="Open Pharmacy"
                onClick={() => navigate(ROUTES.pharmacy, { state: { returnPath: ROUTES.dashboard } })}
              >
                <div className="home-card__body">
                  <h3 className="home-card__title">Pharmacy</h3>
                  <span className="home-badge home-badge--sm">UP TO 30% OFF</span>
                </div>
                <div
                  className="home-card__media"
                  style={{ backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.pharmacy) }}
                />
              </button>
            </div>
          </div>

          <Link to={ROUTES.digitalDiary} className="home-digital-diary">
            <div className="home-digital-diary__inner">
              <div className="home-digital-diary__copy">
                <h3 className="home-digital-diary__title">Your digital diary</h3>
                <p className="home-digital-diary__desc">
                  Jot down vitals, water, workouts, mood, and medicines—your day-to-day health story,
                  organised in one place.
                </p>
                <span className="home-digital-diary__cta">
                  Open diary
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
              <div className="home-digital-diary__art" aria-hidden>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 6h13v13H8z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M6 8H5a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M11 11h6M11 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </Link>

          <HealthClubSection />

          <Link to={ROUTES.services} className="home-view-more">
            VIEW MORE
          </Link>
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

            <div className="service-hub-grid global-bottom-sheet-grid--cols-2">
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
                  navigate("/diagnostics/health-checkups");
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
                  navigate("/diagnostics/lab-tests");
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

            <div className="service-hub-grid global-bottom-sheet-grid--cols-2">
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

      {isVisionSheetOpen ? (
        <dialog
          className="home-sheet-dialog"
          open
          aria-label="Vision"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsVisionSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsVisionSheetOpen(false);
          }}
        >
          <section className="home-sheet home-sheet--vision">
            <header className="home-sheet__header">
              <h3 className="home-sheet__title">Vision</h3>
              <button
                type="button"
                className="home-sheet__close"
                aria-label="Close"
                onClick={() => setIsVisionSheetOpen(false)}
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

            <div className="service-hub-grid global-bottom-sheet-grid--cols-2">
              <ServiceHubCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect
                      x="5"
                      y="3"
                      width="14"
                      height="18"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                    <path
                      d="M9 15.5h6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                }
                title="Eye Checkup"
                description="Comprehensive eye examination"
                onClick={() => {
                  setIsVisionSheetOpen(false);
                  navigate(generatePath(ROUTES.visionSelectPeople, { visionType: VISION_ROUTE_TYPE.eyeCheckup }));
                }}
              />
              <ServiceHubCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                }
                title="Glasses/Lens"
                description="Browse glasses & contact lenses"
                onClick={() => {
                  setIsVisionSheetOpen(false);
                  navigate(generatePath(ROUTES.visionSelectPeople, { visionType: VISION_ROUTE_TYPE.glassesLens }));
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
