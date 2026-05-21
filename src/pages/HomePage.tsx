import { HomeNotificationIcon, HomeProfileIcon, HomeVoiceRecordIcon, HomeSearchIcon, HomeWalletIcon } from "@/assets/icons/react";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import { deliveryAddressChooserAriaLabel } from "@/constants/selectedAddressStorage";
import healthCheckupSvg from "@/assets/icons/Dashboard/HealthCheckup.svg";
import labTestsSvg from "@/assets/icons/Dashboard/LabTests.svg";
import atHospitalSvg from "@/assets/icons/Dashboard/AtHospital.svg";
import virtualSvg from "@/assets/icons/Dashboard/Virtual.svg";
import BorderGlow from "@/components/borderGlow/BorderGlow";
import { HomePromoCarousel } from "@/components/home/HomePromoCarousel";
import { HomeSearchOverlay } from "@/components/home/HomeSearchOverlay";
import TextType from "@/components/textType/TextType";
import blogPromoImg from "@/assets/images/blog.png";
import digitalDiaryPromoImg from "@/assets/images/digitaldiary.png";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { DashboardHalfTileFeatures } from "@/components/dashboard/DashboardHalfTileFeatures";
import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import type { DashboardOngoingItem } from "@/api/patientDashboard";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import {
  HOME_IMAGE_URLS,
  ROUTES,
  VISION_ROUTE_TYPE,
  WELLNESS_SESSION_KIND,
} from "@/constants";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import type { HomeSearchAction } from "@/constants/homeSearchIndex";
import { HOME_SEARCH_ACTIONS } from "@/constants/homeSearchIndex";
import { HOME_SEARCH_TYPEWRITER_SUFFIXES } from "@/constants/homeSearchTypewriter";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useToast } from "@/hooks/useToast";
import {
  type WebSpeechErrorCode,
  useWebSpeechRecognition,
} from "@/hooks/useWebSpeechRecognition";
import { cssBackgroundUrl } from "@/lib/cssBackgroundUrl";
import {
  addHomeRecentSearch,
  loadHomeRecentSearches,
  saveHomeRecentSearches,
} from "@/lib/homeRecentSearchesStorage";
import { rankHomeSearchActions } from "@/lib/homeSearchScore";
import { orderDetailKindInUrlFromDashboardOngoing } from "@/lib/orderDetailRoutes";
import { useHomeBannerCarousel } from "@/hooks/useHomeBannerCarousel";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { DashboardHalfTileGraphic } from "@/lib/dashboardHalfTileGraphic";
import {
  DASHBOARD_DIAGNOSTICS_CARD_COPY,
  DASHBOARD_HALF_TILE_COPY,
  selectDashboardHalfTiles,
  type DashboardHalfTileKind,
} from "@/lib/dashboardServiceGrid";
import {
  DIAG_SUB_HEALTH_CHECKUPS,
  DIAG_SUB_LAB_TESTS,
  diagnosticsSingleVisibleSlug,
} from "@/lib/subscriptionDashboardModules";
import { consultationSingleVisibleType } from "@/lib/moduleGatesFromProfile";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { generatePath, Link, useNavigate } from "react-router-dom";
import "@/components/home/HomeSearchOverlay.css";
import "./HomePage.css";
import "./DigitalDiaryPages.css";
import "./ServicesHubPage.css";

/** Home — blogs teaser (routes to {@link ROUTES.healthClub}). */
const HOME_BLOG_PROMO_COPY = {
  title: "Learn, Read & Stay Healthy",
  description:
    "Stay informed with expert-written blogs on wellness, medicine, and lifestyle.",
  cta: "Discover More",
} as const;

/** BorderGlow — diagnostics featured card only. */
const HOME_CARD_BORDER_GLOW_PROPS = {
  lightTheme: true,
  edgeSensitivity: 20,
  glowColor: "265 60 68",
  backgroundColor: "#ffffff",
  borderRadius: 15,
  glowRadius: 26,
  glowIntensity: 1.25,
  coneSpread: 26,
  animated: false,
  colors: ["#8b5cf6", "#db2777", "#0284c7"] as string[],
  fillOpacity: 0.38,
};

/** Status chip tint — mirrors Flutter `DashboardUpcomingOrdersSection._statusFg/_statusBg`. */
function ongoingStatusBadgeClass(label: string): string {
  const s = label.toLowerCase();
  if (s.includes("completed")) return "home-ongoing-dash-card__status--completed";
  if (s.includes("cancel") || s.includes("expired")) return "home-ongoing-dash-card__status--danger";
  if (s.includes("payment pending")) return "home-ongoing-dash-card__status--warning";
  if (s.includes("upcoming") || s.includes("session")) return "home-ongoing-dash-card__status--info";
  if (s.includes("confirmed")) return "home-ongoing-dash-card__status--info";
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

/** Prefer numeric `info.status` / service code (same as order detail); aligns chip with {@link parseOngoingServiceStatusCode}. */
function ongoingStatusBadgeClassForItem(item: DashboardOngoingItem): string {
  const code = item.status;
  if (typeof code === "number" && code >= 0) {
    switch (code) {
      case 1:
        return "home-ongoing-dash-card__status--completed";
      case 2:
      case 9:
        return "home-ongoing-dash-card__status--danger";
      case 4:
        return "home-ongoing-dash-card__status--warning";
      case 5:
        return "home-ongoing-dash-card__status--info";
      case 0:
      case 3:
      case 6:
      case 7:
      case 8:
        return "home-ongoing-dash-card__status--warning";
      default:
        break;
    }
  }
  return ongoingStatusBadgeClass(item.statusLabel);
}

/** Dots for slide counts 2–7; at 8+ use compact progress + prev/next (too many dots otherwise). */
const HOME_CAROUSEL_DOT_MAX = 7;

function homeVoiceSearchErrorMessage(code: WebSpeechErrorCode): string | null {
  switch (code) {
    case "not-supported":
      return "Voice search isn’t available in this browser.";
    case "start-failed":
      return "Could not start voice search. Try again.";
    case "not-allowed":
      return "Microphone permission denied. Allow the mic to use voice search.";
    case "no-speech":
      return "No speech detected. Try again.";
    case "audio-capture":
      return "No microphone found. Check your device settings.";
    case "network":
      return "Voice search failed due to a network error.";
    case "service-not-allowed":
      return "Voice search isn’t available on this page (use HTTPS).";
    case "aborted":
      return null;
    default:
      return "Voice search couldn’t complete. Try again.";
  }
}

export function HomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    apiBanners,
    notificationCount,
    ongoing,
    ahc,
    loading: dashboardLoading,
  } = useHomeDashboard();
  const mod = useProfileModuleGates();
  /** Diagnostics card: `plan.modules.Lab` / `Diagnostic` + subscription gates from profile (cached in localStorage, then refreshed). */
  const showDiagnosticsTile = mod.showLabDiagnosticsTile;
  const showDiagSheetHealthCheckups =
    !mod.loaded ||
    !mod.diagnosticsHiddenSubSlugs.has(DIAG_SUB_HEALTH_CHECKUPS);
  const showDiagSheetLabTests =
    !mod.loaded ||
    !mod.diagnosticsHiddenSubSlugs.has(DIAG_SUB_LAB_TESTS);
  /** One branch hidden → go straight to the other; never open the picker sheet (uses cached profile before refresh). */
  const diagnosticsDirectSlug = useMemo(
    () => diagnosticsSingleVisibleSlug(mod.diagnosticsHiddenSubSlugs),
    [mod.diagnosticsHiddenSubSlugs],
  );

  const homeSearchActionsFiltered = useMemo(() => {
    const h = mod.diagnosticsHiddenSubSlugs;
    return HOME_SEARCH_ACTIONS.filter((a) => {
      if (a.id === "health-checkups" && h.has(DIAG_SUB_HEALTH_CHECKUPS)) return false;
      if (a.id === "lab-tests" && h.has(DIAG_SUB_LAB_TESTS)) return false;
      return true;
    });
  }, [mod.diagnosticsHiddenSubSlugs]);

  const hasDeliveryAddress = useHasSelectedDeliveryAddress();

  useEffect(() => {
    void ensureDefaultSelectedAddressIfNeeded();
  }, []);

  const ongoingCount = ongoing.length;
  const showOngoingDashboardChrome = dashboardLoading || ongoingCount > 0;
  const apiBannerCount = apiBanners.length;
  const homeCarouselCount = apiBannerCount;
  const {
    activeIndex: activeHomeCarousel,
    extendedPos: bannerExtendedPos,
    extendedCount: homeBannerExtendedCount,
    translatePercent: homeBannerTranslatePercent,
    instantMove: homeBannerInstantMove,
    goTo: goToHomeCarousel,
    stepNext: stepHomeBannerNext,
    stepPrev: stepHomeBannerPrev,
    onTouchStart: onHomeCarouselTouchStart,
    onTouchEnd: onHomeCarouselTouchEnd,
    onTrackTransitionEnd: onHomeBannerTrackTransitionEnd,
  } = useHomeBannerCarousel({ slideCount: homeCarouselCount });

  const homeBannerSlides = useMemo(() => {
    if (apiBanners.length <= 1) {
      return apiBanners.map((slide, index) => ({
        key: slide.id != null ? `banner-${String(slide.id)}` : `banner-${slide.image}-${index}`,
        slide,
      }));
    }
    const n = apiBanners.length;
    const last = apiBanners[n - 1]!;
    const first = apiBanners[0]!;
    return [
      {
        key: `banner-clone-prev-${last.id ?? last.image}`,
        slide: last,
      },
      ...apiBanners.map((slide, index) => ({
        key: slide.id != null ? `banner-${String(slide.id)}` : `banner-${slide.image}-${index}`,
        slide,
      })),
      {
        key: `banner-clone-next-${first.id ?? first.image}`,
        slide: first,
      },
    ];
  }, [apiBanners]);

  const {
    activeIndex: activeOngoingIndex,
    extendedPos: ongoingExtendedPos,
    extendedCount: ongoingExtendedCount,
    translatePercent: ongoingTranslatePercent,
    instantMove: ongoingInstantMove,
    goTo: goToOngoingCarousel,
    viewportRef: ongoingCarouselViewportRef,
    onTouchStart: onOngoingCarouselTouchStart,
    onTouchEnd: onOngoingCarouselTouchEnd,
    onPointerDown: onOngoingCarouselPointerDown,
    onPointerMove: onOngoingCarouselPointerMove,
    onPointerUp: onOngoingCarouselPointerUp,
    onPointerCancel: onOngoingCarouselPointerCancel,
    onViewportClickCapture: onOngoingCarouselClickCapture,
    onTrackTransitionEnd: onOngoingTrackTransitionEnd,
  } = useHomeBannerCarousel({ slideCount: ongoingCount, autoAdvanceMs: 0 });

  const ongoingSlides = useMemo(() => {
    if (ongoing.length <= 1) {
      return ongoing.map((item) => ({ key: item.id, item }));
    }
    const n = ongoing.length;
    const last = ongoing[n - 1]!;
    const first = ongoing[0]!;
    return [
      { key: `ongoing-clone-prev-${last.id}`, item: last },
      ...ongoing.map((item) => ({ key: item.id, item })),
      { key: `ongoing-clone-next-${first.id}`, item: first },
    ];
  }, [ongoing]);

  const [isDiagnosticsSheetOpen, setIsDiagnosticsSheetOpen] = useState(false);
  const [isConsultationSheetOpen, setIsConsultationSheetOpen] = useState(false);
  const [isVisionSheetOpen, setIsVisionSheetOpen] = useState(false);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [homeSearchFocused, setHomeSearchFocused] = useState(false);
  const [homeRecentSearches, setHomeRecentSearches] = useState<string[]>(() => loadHomeRecentSearches());
  const homeSearchInputRef = useRef<HTMLInputElement>(null);

  const dashboardHalfTiles = useMemo(() => selectDashboardHalfTiles(mod), [mod]);
  const navigateDashboardHalfTile = useCallback(
    (kind: DashboardHalfTileKind) => {
      switch (kind) {
        case "consultation": {
          const direct =
            mod.loaded && consultationSingleVisibleType(mod.consultation);
          if (direct) {
            void navigate(generatePath(ROUTES.consultation, { type: direct }));
            return;
          }
          setIsConsultationSheetOpen(true);
          return;
        }
        case "vision":
          setIsVisionSheetOpen(true);
          return;
        case "dental":
          void navigate(ROUTES.dentalSelectPeople);
          return;
        case "pharmacy":
          void navigate(ROUTES.pharmacy, {
            state: { returnPath: ROUTES.dashboard },
          });
          return;
        case "vaccination":
          void navigate(ROUTES.vaccinationSelectPeople);
          return;
        case "mental":
          void navigate(
            generatePath(ROUTES.servicesWellness, {
              wellnessKind: WELLNESS_SESSION_KIND.mentalWellness,
            }),
          );
          return;
        case "chronic":
          void navigate(ROUTES.chronic, {
            state: { returnPath: ROUTES.dashboard, fromDashboard: true },
          });
          return;
        case "nutrition":
          void navigate(
            generatePath(ROUTES.servicesWellness, {
              wellnessKind: WELLNESS_SESSION_KIND.nutrition,
            }),
          );
          return;
        case "gym":
          void navigate(ROUTES.gymMembership);
          return;
        case "claim":
          void navigate(ROUTES.claims, {
            state: { returnPath: ROUTES.dashboard },
          });
          return;
        default:
          return;
      }
    },
    [navigate, mod.loaded, mod.consultation],
  );
  const debouncedHomeSearch = useDebouncedValue(homeSearchQuery, 200);
  const homeSearchRanked = useMemo(
    () => rankHomeSearchActions(debouncedHomeSearch, homeSearchActionsFiltered),
    [debouncedHomeSearch, homeSearchActionsFiltered],
  );

  const onHomeVoiceError = useCallback(
    (code: WebSpeechErrorCode) => {
      const msg = homeVoiceSearchErrorMessage(code);
      if (msg) toast.error(msg);
    },
    [toast],
  );

  const { supported: voiceSearchSupported, listening: voiceSearchListening, toggle: toggleVoiceSearch, stop: stopVoiceSearch } =
    useWebSpeechRecognition({
      onTranscript: setHomeSearchQuery,
      onError: onHomeVoiceError,
    });

  const handleHomeSearchResult = useCallback(
    (action: HomeSearchAction) => {
      stopVoiceSearch();
      const q = homeSearchQuery.trim();
      if (q) {
        addHomeRecentSearch(q);
        setHomeRecentSearches(loadHomeRecentSearches());
      }
      setHomeSearchQuery("");
      setHomeSearchFocused(false);
      homeSearchInputRef.current?.blur();
      navigate(action.to);
    },
    [homeSearchQuery, navigate, stopVoiceSearch],
  );

  const handleHomeRecentSelect = useCallback((text: string) => {
    setHomeSearchQuery(text);
    requestAnimationFrame(() => homeSearchInputRef.current?.focus());
  }, []);

  const handleHomeRecentRemove = useCallback((text: string) => {
    setHomeRecentSearches((prev) => {
      const next = prev.filter((t) => t !== text);
      saveHomeRecentSearches(next);
      return next;
    });
  }, []);

  const handleHomeClearRecents = useCallback(() => {
    setHomeRecentSearches([]);
    saveHomeRecentSearches([]);
  }, []);

  /** Patient-app `DashboardController.openSponsoredHealthCheckup` + compact promo card. */
  const handlePromoAhcClick = useCallback(() => {
    void navigate(
      `${generatePath(ROUTES.diagnosticsSelectPeople, {
        type: "health-checkups",
      })}?sponsored=1&ahc=1`,
    );
  }, [navigate]);

  /** Patient-app `DashboardController.onTapGymCard` (subscription gate). */
  const handlePromoGymClick = useCallback(() => {
    if (mod.loaded && !mod.serviceHub.gym) {
      toast.error("Gym is not available on your current plan.");
      return;
    }
    void navigate(ROUTES.gymMembership);
  }, [mod.loaded, mod.serviceHub.gym, navigate, toast]);

  /** Hub sheets only — address sheet locks scroll inside {@link AddressBottomSheet} (avoid nested body locks). */
  useEffect(() => {
    const isAnySheetOpen =
      isDiagnosticsSheetOpen || isConsultationSheetOpen || isVisionSheetOpen;
    if (!isAnySheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isDiagnosticsSheetOpen, isConsultationSheetOpen, isVisionSheetOpen]);

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
            onClick={() => stepHomeBannerPrev()}
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
            onClick={() => stepHomeBannerNext()}
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
            aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
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
              <AddressStripLabels
                layout="pipe"
                titleClassName="home-loc__title"
                sepClassName="home-loc__sep"
                addrClassName="home-loc__addr"
                promptClassName="home-loc__addr home-loc__addr--prompt"
              />
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

        <div className="home-search-block">
          <div className="home-search">
            <span className="home-search__search-ic" aria-hidden="true">
              <HomeSearchIcon />
            </span>
            <div className="home-search__field">
              <input
                ref={homeSearchInputRef}
                type="search"
                className="home-search__input"
                value={homeSearchQuery}
                onChange={(e) => setHomeSearchQuery(e.target.value)}
                onFocus={() => setHomeSearchFocused(true)}
                onBlur={() => setHomeSearchFocused(false)}
                placeholder=""
                aria-label="Search for pharmacy, diagnostics, claims, consultation, and more"
                autoComplete="off"
                enterKeyHint="search"
              />
              {homeSearchQuery === "" && !homeSearchFocused ? (
                <div className="home-search__typewrap" aria-hidden>
                  <span className="home-search__type home-search__type--prefix">Search for </span>
                  <TextType
                    as="span"
                    className="home-search__type home-search__type--rotating"
                    text={[...HOME_SEARCH_TYPEWRITER_SUFFIXES]}
                    typingSpeed={75}
                    pauseDuration={1500}
                    deletingSpeed={28}
                    showCursor={false}
                    startOnVisible
                  />
                </div>
              ) : null}
            </div>
            <span className="home-search__divider" aria-hidden="true" />
            <button
              type="button"
              className={`home-search__mic${voiceSearchListening ? " home-search__mic--listening" : ""}`}
              aria-label={voiceSearchListening ? "Stop voice search" : "Voice search"}
              aria-pressed={voiceSearchListening}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!voiceSearchSupported) {
                  toast.error("Voice search isn’t available in this browser.");
                  return;
                }
                setHomeSearchFocused(true);
                homeSearchInputRef.current?.focus();
                toggleVoiceSearch();
              }}
            >
              <HomeVoiceRecordIcon className={voiceSearchListening ? "home-search__mic-img--listening" : undefined} />
            </button>
          </div>
          {homeSearchFocused ? (
            <HomeSearchOverlay
              query={homeSearchQuery}
              results={homeSearchRanked}
              recents={homeRecentSearches}
              onResultNavigate={handleHomeSearchResult}
              onRecentSelect={handleHomeRecentSelect}
              onRecentRemove={handleHomeRecentRemove}
              onClearRecents={handleHomeClearRecents}
            />
          ) : null}
        </div>
      </div>

      <main
        className={`home-page__main${showOngoingDashboardChrome ? " home-page__main--ongoing-float-gap" : ""}`}
      >
        <section className="home-section" aria-labelledby="services-heading">
          <h2 id="services-heading" className="visually-hidden">
            Medical services
          </h2>

          {/* Patient-app `DashboardHomeScreen`: `DashboardPromoCarousel` (AHC when `ahc` + gym). */}
          <HomePromoCarousel
            showAhc={ahc}
            onAhcClick={handlePromoAhcClick}
            onGymClick={handlePromoGymClick}
          />

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
                  className={`home-banner__track${homeBannerInstantMove ? " home-banner__track--instant" : ""}`}
                  style={{
                    width: `${homeBannerExtendedCount * 100}%`,
                    transform: `translateX(${homeBannerTranslatePercent}%)`,
                  }}
                  onTransitionEnd={(e) => {
                    if (e.propertyName !== "transform") return;
                    onHomeBannerTrackTransitionEnd();
                  }}
                >
                  {homeBannerSlides.map(({ key, slide }, index) => (
                    <div
                      key={key}
                      className="home-banner__slide home-banner__slide--api"
                      style={{ flex: `0 0 ${100 / homeBannerExtendedCount}%` }}
                      aria-hidden={index !== bannerExtendedPos}
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

          {showDiagnosticsTile ? (
          <BorderGlow
            className="home-diagnostics-border-glow-wrap"
            {...HOME_CARD_BORDER_GLOW_PROPS}
          >
            <button
              type="button"
              className="home-card home-card--featured home-card--clickable home-card--btn"
              aria-label={
                diagnosticsDirectSlug
                  ? `Open ${diagnosticsDirectSlug === "health-checkups" ? "health checkups" : "lab tests"}`
                  : "Open Diagnostics options"
              }
              onClick={() => {
                if (diagnosticsDirectSlug) {
                  void navigate(
                    generatePath(ROUTES.diagnosticsType, { type: diagnosticsDirectSlug }),
                  );
                  return;
                }
                setIsDiagnosticsSheetOpen(true);
              }}
            >
              <div className="home-card__body">
                <h3 className="home-card__title">{DASHBOARD_DIAGNOSTICS_CARD_COPY.title}</h3>
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
                  <span className="home-card__slot-text">
                    {DASHBOARD_DIAGNOSTICS_CARD_COPY.sameDaySlot}
                  </span>
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
                    {DASHBOARD_DIAGNOSTICS_CARD_COPY.homeCollection}
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
                    {DASHBOARD_DIAGNOSTICS_CARD_COPY.atCenter}
                  </span>
                </div>
                <span className="home-badge home-badge--soft">
                  {DASHBOARD_DIAGNOSTICS_CARD_COPY.badgeText}
                </span>
              </div>
              <div
                className="home-card__media home-card__media--lg"
                style={{ backgroundImage: cssBackgroundUrl(HOME_IMAGE_URLS.diagnostics) }}
              />
            </button>
          </BorderGlow>
          ) : null}

          <div className="home-grid-wrap">
            <div className="home-grid">
              {dashboardHalfTiles.map((kind) => {
                const copy = DASHBOARD_HALF_TILE_COPY[kind];
                let ariaLabel = `Open ${copy.title}`;
                if (kind === "consultation") ariaLabel = "Open Consultation options";
                else if (kind === "vision") ariaLabel = "Open Vision options";
                return (
                  <button
                    key={kind}
                    type="button"
                    className="home-card home-card--tile home-card--btn home-card--clickable"
                    aria-label={ariaLabel}
                    onClick={() => navigateDashboardHalfTile(kind)}
                  >
                    <div className="home-card__body">
                      <h3 className="home-card__title">{copy.title}</h3>
                      {copy.meta ? (
                        <p className="home-card__meta">{copy.meta}</p>
                      ) : null}
                      {copy.features && copy.features.length > 0 ? (
                        <DashboardHalfTileFeatures features={copy.features} />
                      ) : null}
                      {copy.badgeText ? (
                        <span className="home-badge home-badge--sm">{copy.badgeText}</span>
                      ) : null}
                    </div>
                    <DashboardHalfTileGraphic kind={kind} />
                  </button>
                );
              })}
            </div>
          </div>

          {mod.loaded && mod.gateOk ? (
            <Link to={ROUTES.services} className="home-view-more">
              VIEW MORE
            </Link>
          ) : null}

          <div className="home-promo-cards">
            <Link
              to={ROUTES.digitalDiary}
              className="home-promo-card"
              aria-label={`${DIGITAL_DIARY_COPY.dashboardActivitiesTitle}: ${DIGITAL_DIARY_COPY.dashboardActivitiesCta}`}
            >
              <div className="home-promo-card__inner">
                <div className="home-promo-card__copy">
                  <h3 className="home-promo-card__title">
                    {DIGITAL_DIARY_COPY.dashboardActivitiesTitle}
                  </h3>
                  <p className="home-promo-card__desc">
                    {DIGITAL_DIARY_COPY.dashboardActivitiesSubtitle}
                  </p>
                  <span className="home-promo-card__cta">
                    {DIGITAL_DIARY_COPY.dashboardActivitiesCta}
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
                <div className="home-promo-card__art" aria-hidden>
                  <img
                    src={digitalDiaryPromoImg}
                    alt=""
                    width={112}
                    height={112}
                    draggable={false}
                    className="home-promo-card__img"
                  />
                </div>
              </div>
            </Link>

            <Link
              to={ROUTES.healthClub}
              className="home-promo-card"
              aria-label={`${HOME_BLOG_PROMO_COPY.title}: ${HOME_BLOG_PROMO_COPY.cta}`}
            >
              <div className="home-promo-card__inner">
                <div className="home-promo-card__copy">
                  <h3 className="home-promo-card__title">{HOME_BLOG_PROMO_COPY.title}</h3>
                  <p className="home-promo-card__desc">{HOME_BLOG_PROMO_COPY.description}</p>
                  <span className="home-promo-card__cta">
                    {HOME_BLOG_PROMO_COPY.cta}
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
                <div className="home-promo-card__art" aria-hidden>
                  <img
                    src={blogPromoImg}
                    alt=""
                    width={112}
                    height={112}
                    draggable={false}
                    className="home-promo-card__img"
                  />
                </div>
              </div>
            </Link>
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

            <div className="service-hub-grid global-bottom-sheet-grid--cols-2">
              {showDiagSheetHealthCheckups ? (
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
                  void navigate(generatePath(ROUTES.diagnosticsType, { type: "health-checkups" }));
                }}
              />
              ) : null}
              {showDiagSheetLabTests ? (
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
                  void navigate(generatePath(ROUTES.diagnosticsType, { type: "lab-tests" }));
                }}
              />
              ) : null}
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
              {!mod.loaded || mod.consultation.sheetHospital ? (
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
              ) : null}
              {!mod.loaded || mod.consultation.sheetVirtual ? (
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
              ) : null}
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
              {!mod.loaded || mod.vision.sheetClinic ? (
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
              ) : null}
              {!mod.loaded || mod.vision.sheetStore ? (
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
              ) : null}
            </div>
          </section>
        </dialog>
      ) : null}

      {showOngoingDashboardChrome ? (
        <div
          className="home-ongoing-float"
          role="region"
          aria-labelledby="ongoing-orders-float-heading"
        >
          <div className="home-ongoing-float__header">
            <h2 id="ongoing-orders-float-heading" className="home-ongoing-section__title">
              Ongoing Orders
            </h2>
            <button
              type="button"
              className="home-ongoing-section__view-all"
              disabled={dashboardLoading && ongoingCount === 0}
              onClick={() =>
                navigate(ROUTES.orders, { state: { dashboardOngoing: ongoing } })
              }
            >
              <span>View All</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {dashboardLoading && ongoingCount === 0 ? (
            <div className="home-ongoing-float__skeleton" aria-busy="true" aria-live="polite">
              <div className="home-ongoing-float__sk-row">
                <span className="home-ongoing-float__sk-pill" />
                <span className="home-ongoing-float__sk-pill home-ongoing-float__sk-pill--sm" />
              </div>
              <div className="home-ongoing-float__sk-card" />
            </div>
          ) : (
            <>
              <div
                ref={ongoingCarouselViewportRef}
                className="home-ongoing-carousel-viewport home-ongoing-float__viewport"
                onTouchStart={onOngoingCarouselTouchStart}
                onTouchEnd={onOngoingCarouselTouchEnd}
                onPointerDown={onOngoingCarouselPointerDown}
                onPointerMove={onOngoingCarouselPointerMove}
                onPointerUp={onOngoingCarouselPointerUp}
                onPointerCancel={onOngoingCarouselPointerCancel}
                onClickCapture={onOngoingCarouselClickCapture}
                aria-roledescription="carousel"
                aria-label="Ongoing orders — swipe, drag, or scroll to change"
              >
                <div
                  className={`home-ongoing-carousel__track${ongoingInstantMove ? " home-ongoing-carousel__track--instant" : ""}`}
                  style={{
                    width: `${ongoingExtendedCount * 100}%`,
                    transform: `translateX(${ongoingTranslatePercent}%)`,
                  }}
                  onTransitionEnd={(e) => {
                    if (e.propertyName !== "transform") return;
                    onOngoingTrackTransitionEnd();
                  }}
                >
                  {ongoingSlides.map(({ key, item }, index) => (
                    <div
                      key={key}
                      className="home-ongoing-carousel__slide"
                      style={{ flex: `0 0 ${100 / ongoingExtendedCount}%` }}
                      aria-hidden={index !== ongoingExtendedPos}
                    >
                      <div className="home-ongoing-dash-card">
                        <div className="home-ongoing-dash-card__layout">
                          <button
                            type="button"
                            className="home-ongoing-dash-card__primary"
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
                                width={20}
                                height={20}
                              />
                            </span>
                            <span className="home-ongoing-dash-card__content">
                              <span className="home-ongoing-dash-card__category">
                                {item.displayCategory}  {item.visitTypeLabel ? (
                                <span className="home-ongoing-dash-card__visit-type">
                                  {item.visitTypeLabel}
                                </span>
                              ) : null}
                              </span>
                              <span className="home-ongoing-dash-card__meta-row">
                                {/* <span className="home-ongoing-dash-card__patient">
                                  {item.patientLine}
                                </span> */}
                                <span className="home-ongoing-dash-card__when">{item.whenLine}</span>
                              </span>
                             
                              {/* {item.memberCount > 1 ? (
                                <span className="home-ongoing-dash-card__members">
                                  +{item.memberCount - 1} members
                                </span>
                              ) : null} */}
                            </span>
                          </button>
                          <div className="home-ongoing-dash-card__aside">
                            <span
                              className={`home-ongoing-dash-card__status ${ongoingStatusBadgeClassForItem(item)}`}
                            >
                              {item.statusLabel}
                            </span>
                            {item.canJoinVideoCall ? (
                              <button
                                type="button"
                                className="home-ongoing-dash-card__join-call"
                                aria-label="Join video call"
                                onClick={() =>
                                  navigate(
                                    generatePath(ROUTES.videoCall, { appointmentId: item.id }),
                                  )
                                }
                              >
                                JOIN
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {ongoingCount > 1 ? (
                <div className="home-ongoing-float__dots-row">
                  <div className="home-ongoing-float__dots" role="tablist" aria-label="Choose order">
                    {ongoing.map((o, i) => (
                      <button
                        key={`ongoing-dot-${o.id}`}
                        type="button"
                        role="tab"
                        aria-selected={i === activeOngoingIndex}
                        className={`home-ongoing-float__dot${i === activeOngoingIndex ? " home-ongoing-float__dot--active" : ""}`}
                        onClick={() => goToOngoingCarousel(i)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="home-ongoing-float__more"
                    onClick={() =>
                      navigate(ROUTES.orders, { state: { dashboardOngoing: ongoing } })
                    }
                  >
                    +{ongoingCount - 1} more
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <HomeBottomNav />
    </div>
  );
}
