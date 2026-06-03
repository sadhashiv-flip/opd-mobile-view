import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  getHubHeading,
  getHubItems,
  HUB_TABS,
  isHubTabId,
  type HubTabId,
} from "@/constants/servicesHubContent";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import {
  DIAG_SUB_HEALTH_CHECKUPS,
  DIAG_SUB_LAB_TESTS,
  diagnosticsSingleVisibleSlug,
} from "@/lib/subscriptionDashboardModules";
import { consultationSingleVisibleType } from "@/lib/moduleGatesFromProfile";
import atHospitalSvg from "@/assets/icons/Dashboard/AtHospital.svg";
import healthCheckupSvg from "@/assets/icons/Dashboard/HealthCheckup.svg";
import labTestsSvg from "@/assets/icons/Dashboard/LabTests.svg";
import virtualSvg from "@/assets/icons/Dashboard/Virtual.svg";
import { ROUTES, VISION_ROUTE_TYPE, WELLNESS_SESSION_KIND } from "@/constants";
import { DeleteAccountModal } from "@/components/profile";
import { requestProfileDeletion } from "@/api/patientProfileDelete";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, generatePath, useNavigate, useSearchParams } from "react-router-dom";
import "@/pages/HomePage.css";
import "./ServicesHubPage.css";

function parseTab(raw: string | null): HubTabId {
  if (raw && isHubTabId(raw)) {
    return raw;
  }
  return "services";
}

function getAccountRoute(id: string): string | null {
  switch (id) {
    case "profile":
      return ROUTES.profile;
    case "subs":
      return ROUTES.profileSubscriptions;
    case "family":
      return ROUTES.profileMembers;
    case "address":
      return ROUTES.profileAddress;
    case "orders":
      return ROUTES.orders;
    case "bank":
      return ROUTES.profileBank;
    case "delete":
      return null; // modal
    default:
      return null;
  }
}

export function ServicesHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabId = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams],
  );

  const mod = useProfileModuleGates();

  const visibleHubTabs = useMemo(() => {
    if (!mod.loaded || mod.showOpdClaimsHubTab) return HUB_TABS;
    return HUB_TABS.filter((t) => t.id !== "opd-claims");
  }, [mod.loaded, mod.showOpdClaimsHubTab]);

  useEffect(() => {
    if (!mod.loaded) return;
    if (tabId === "opd-claims" && !mod.showOpdClaimsHubTab) {
      setSearchParams({ tab: "services" }, { replace: true });
    }
  }, [mod.loaded, mod.showOpdClaimsHubTab, setSearchParams, tabId]);
  const hubItems = useMemo(() => {
    const raw = getHubItems(tabId);
    if (tabId !== "services") return raw;
    const g = mod.serviceHub;
    return raw.filter((item) => {
      if (!mod.loaded) return true;
      switch (item.id) {
        case "diag":
          return g.diag;
        case "consult":
          return g.consult;
        case "dental":
          return g.dental;
        case "pharm":
          return g.pharm;
        case "vax":
          return g.vax;
        case "vision":
          return g.vision;
        case "mental":
          return g.mental;
        case "chronic":
          return g.chronic;
        case "nutrition":
          return g.nutrition;
        case "fitness":
          return g.fitness;
        case "gym":
          return g.gym;
        default:
          return true;
      }
    });
  }, [tabId, mod]);

  const navigate = useNavigate();
  const toast = useToast();

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [visionSheetOpen, setVisionSheetOpen] = useState(false);
  const [diagnosticsSheetOpen, setDiagnosticsSheetOpen] = useState(false);
  const [consultationSheetOpen, setConsultationSheetOpen] = useState(false);

  const setTab = useCallback(
    (id: HubTabId) => {
      setSearchParams({ tab: id }, { replace: true });
    },
    [setSearchParams],
  );

  const heading = getHubHeading(tabId);
  const gridCols = 2;

  useEffect(() => {
    const anySheet =
      visionSheetOpen || diagnosticsSheetOpen || consultationSheetOpen;
    if (!anySheet) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visionSheetOpen, diagnosticsSheetOpen, consultationSheetOpen]);

  return (
    <div className="services-hub">
      <header className="services-hub__top">
        <Link
          to={ROUTES.dashboard}
          className="services-hub__back"
          aria-label="Back to home"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <nav className="services-hub__tabs" aria-label="Service categories">
          {visibleHubTabs.map(({ id, label, Icon, iconSrc }) => {
            const active = tabId === id;
            const TabIcon = Icon;
            let tabIconNode = null;
            if (iconSrc) {
              tabIconNode = (
                <img
                  src={iconSrc}
                  alt=""
                  width={24}
                  height={24}
                  draggable={false}
                  className="services-hub__tab-icon services-hub__tab-icon--asset"
                />
              );
            } else if (TabIcon) {
              tabIconNode = (
                <TabIcon
                  aria-hidden="true"
                  className="services-hub__tab-icon"
                />
              );
            }
            return (
              <button
                key={id}
                type="button"
                className={`services-hub__tab${active ? " services-hub__tab--active" : ""}`}
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
              >
                {tabIconNode}
                <span className="services-hub__tab-label">{label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main className="services-hub__main">
        <h1 className="services-hub__title">{heading}</h1>
        {hubItems.length > 0 ? (
        <div
          className={`service-hub-grid service-hub-grid--cols-${gridCols}`}
        >
          {hubItems.map((item) => {
            const Icon = item.Icon;
            const isMedical = tabId === "medical-records";

            let iconNode = null;
            if (item.iconSrc) {
              iconNode = (
                <img
                  src={item.iconSrc}
                  alt=""
                  className="service-hub-card__img-icon"
                  width={22}
                  height={22}
                  draggable={false}
                />
              );
            } else if (Icon) {
              iconNode = <Icon aria-hidden />;
            }

            let cardAction: (() => void) | undefined;
            if (tabId === "services" && item.id === "diag") {
              cardAction = () => {
                const slug = diagnosticsSingleVisibleSlug(mod.diagnosticsHiddenSubSlugs);
                if (slug) {
                  void navigate(generatePath(ROUTES.diagnosticsType, { type: slug }));
                  return;
                }
                setDiagnosticsSheetOpen(true);
              };
            } else if (tabId === "services" && item.id === "consult") {
              cardAction = () => {
                const direct =
                  mod.loaded && consultationSingleVisibleType(mod.consultation);
                if (direct) {
                  void navigate(generatePath(ROUTES.consultation, { type: direct }));
                  return;
                }
                setConsultationSheetOpen(true);
              };
            } else if (tabId === "services" && item.id === "fitness") {
              cardAction = () => {
                void navigate(ROUTES.fitness);
              };
            } else if (tabId === "services" && item.id === "gym") {
              cardAction = () => {
                void navigate(ROUTES.gymMembership);
              };
            } else if (tabId === "services" && item.id === "mental") {
              cardAction = () => {
                void navigate(
                  generatePath(ROUTES.servicesWellness, {
                    wellnessKind: WELLNESS_SESSION_KIND.mentalWellness,
                  }),
                );
              };
            } else if (tabId === "services" && item.id === "nutrition") {
              cardAction = () => {
                void navigate(
                  generatePath(ROUTES.servicesWellness, {
                    wellnessKind: WELLNESS_SESSION_KIND.nutrition,
                  }),
                );
              };
            } else if (tabId === "services" && item.id === "vax") {
              cardAction = () => {
                void navigate(ROUTES.vaccinationSelectPeople);
              };
            } else if (tabId === "services" && item.id === "dental") {
              cardAction = () => {
                void navigate(ROUTES.dentalSelectPeople);
              };
            } else if (tabId === "services" && item.id === "vision") {
              cardAction = () => setVisionSheetOpen(true);
            } else if (
              tabId === "services" &&
              item.id === "pharm"
            ) {
              cardAction = () => {
                void navigate(ROUTES.pharmacy, {
                  state: { returnPath: `${ROUTES.services}?tab=services` },
                });
              };
            } else if (tabId === "services" && item.id === "chronic") {
              cardAction = () => {
                void navigate(ROUTES.chronic, {
                  state: { returnPath: `${ROUTES.services}?tab=services` },
                });
              };
            } else if (tabId === "account") {
              cardAction = () => {
                const route = getAccountRoute(item.id);
                if (route) {
                  void navigate(route, { state: { returnPath: `${ROUTES.services}?tab=account` } });
                } else if (item.id === "delete") {
                  setDeleteAccountOpen(true);
                }
              };
            } else if (tabId === "opd-claims" && item.id === "bank") {
              cardAction = () => {
                void navigate(ROUTES.profileBank, {
                  state: { returnPath: `${ROUTES.services}?tab=opd-claims` },
                });
              };
            } else if (tabId === "opd-claims" && item.id === "claims") {
              cardAction = () => {
                void navigate(ROUTES.claims, {
                  state: { returnPath: `${ROUTES.services}?tab=opd-claims` },
                });
              };
            } else if (tabId === "help") {
              const helpReturn = `${ROUTES.services}?tab=help`;
              if (item.id === "support") {
                cardAction = () => {
                  void navigate(ROUTES.servicesHelpSupport, { state: { returnPath: helpReturn } });
                };
              } else if (item.id === "faq") {
                cardAction = () => {
                  void navigate(ROUTES.profileFaq, { state: { returnPath: helpReturn } });
                };
              } else if (item.id === "tc") {
                cardAction = () => {
                  void navigate(ROUTES.profileTerms, { state: { returnPath: helpReturn } });
                };
              } else if (item.id === "privacy") {
                cardAction = () => {
                  void navigate(ROUTES.profilePrivacyPolicy, { state: { returnPath: helpReturn } });
                };
              }
            } else if (isMedical) {
              if (item.opensDigitalDiary) {
                const returnPath = `${ROUTES.services}?tab=medical-records`;
                cardAction = () => {
                  void navigate(ROUTES.digitalDiary, { state: { returnPath } });
                };
              } else {
                const slug = item.medicalRecordSlug ?? "consultations";
                cardAction = () => {
                  void navigate(generatePath(ROUTES.medicalRecordsCategory, { categorySlug: slug }));
                };
              }
            }

            return (
              <ServiceHubCard
                key={item.id}
                icon={iconNode}
                title={item.title}
                description={item.description}
                badge={item.badge}
                onClick={cardAction}
              />
            );
          })}
        </div>
        ) : null}
      </main>

      {diagnosticsSheetOpen ? (
        <dialog
          className="home-sheet-dialog"
          open
          aria-label="Diagnostics"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDiagnosticsSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDiagnosticsSheetOpen(false);
          }}
        >
          <section className="home-sheet">
            <header className="home-sheet__header">
              <h3 className="home-sheet__title">Diagnostics</h3>
              <button
                type="button"
                className="home-sheet__close"
                aria-label="Close"
                onClick={() => setDiagnosticsSheetOpen(false)}
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
              {!mod.loaded ||
              !mod.diagnosticsHiddenSubSlugs.has(DIAG_SUB_HEALTH_CHECKUPS) ? (
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
                  setDiagnosticsSheetOpen(false);
                  void navigate(generatePath(ROUTES.diagnosticsType, { type: "health-checkups" }));
                }}
              />
              ) : null}
              {!mod.loaded ||
              !mod.diagnosticsHiddenSubSlugs.has(DIAG_SUB_LAB_TESTS) ? (
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
                description="Fully Sponsored"
                onClick={() => {
                  setDiagnosticsSheetOpen(false);
                  void navigate(generatePath(ROUTES.diagnosticsType, { type: "lab-tests" }));
                }}
              />
              ) : null}
            </div>
          </section>
        </dialog>
      ) : null}

      {consultationSheetOpen ? (
        <dialog
          className="home-sheet-dialog"
          open
          aria-label="Consultation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConsultationSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConsultationSheetOpen(false);
          }}
        >
          <section className="home-sheet">
            <header className="home-sheet__header">
              <h3 className="home-sheet__title">Consultation</h3>
              <button
                type="button"
                className="home-sheet__close"
                aria-label="Close"
                onClick={() => setConsultationSheetOpen(false)}
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
                description={"Visit a doctor\nat the hospital"}
                onClick={() => {
                  setConsultationSheetOpen(false);
                  void navigate(generatePath(ROUTES.consultation, { type: "at_hospital" }));
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
                description={"Consult a doctor\nonline from home"}
                onClick={() => {
                  setConsultationSheetOpen(false);
                  void navigate(generatePath(ROUTES.consultation, { type: "virtual" }));
                }}
              />
              ) : null}
            </div>
          </section>
        </dialog>
      ) : null}

      {visionSheetOpen ? (
        <dialog
          className="home-sheet-dialog"
          open
          aria-label="Vision"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVisionSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setVisionSheetOpen(false);
          }}
        >
          <section className="home-sheet home-sheet--vision">
            <header className="home-sheet__header">
              <h3 className="home-sheet__title">Vision</h3>
              <button
                type="button"
                className="home-sheet__close"
                aria-label="Close"
                onClick={() => setVisionSheetOpen(false)}
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
                  setVisionSheetOpen(false);
                  void navigate(
                    generatePath(ROUTES.visionSelectPeople, { visionType: VISION_ROUTE_TYPE.eyeCheckup }),
                  );
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
                  setVisionSheetOpen(false);
                  void navigate(
                    generatePath(ROUTES.visionSelectPeople, { visionType: VISION_ROUTE_TYPE.glassesLens }),
                  );
                }}
              />
              ) : null}
            </div>
          </section>
        </dialog>
      ) : null}

      <HomeBottomNav />

      <DeleteAccountModal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirmDelete={async (feedback) => {
          await requestProfileDeletion({ feedback });
          toast.success("Account deletion requested.");
        }}
      />
    </div>
  );
}
