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
import { SupportTicketFeedbackViewDialog } from "@/components/support/SupportTicketFeedbackViewDialog";
import { SupportTicketFeedbackDialog, FEEDBACK_RATINGS } from "@/components/support/SupportTicketFeedbackDialog";
import { DeleteAccountModal } from "@/components/profile";
import { postSupportFeedback } from "@/api/patientFeedback";
import { requestProfileDeletion } from "@/api/patientProfileDelete";
import { useToast } from "@/hooks/useToast";
import {
  createSupportTicket,
  fetchAllSupportTickets,
  isSupportTicketClosedTabStatus,
  isSupportTicketInactiveStatus,
  parseSupportTicketFeedbackDisplay,
  supportTicketHasFeedback,
  type SupportTicket,
  type SupportTicketFeedbackDisplay,
} from "@/api/supportTicket";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const supportSectionRef = useRef<HTMLDivElement | null>(null);

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportFilter, setSupportFilter] = useState<"open" | "closed">("open");
  const [supportPage, setSupportPage] = useState(1);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportLanguage, setSupportLanguage] = useState("English");
  const [supportBusy, setSupportBusy] = useState(false);
  const [hubFeedbackOpen, setHubFeedbackOpen] = useState(false);
  const [hubFeedbackTicketId, setHubFeedbackTicketId] = useState<string | null>(null);
  const [hubFeedbackRating, setHubFeedbackRating] = useState<(typeof FEEDBACK_RATINGS)[number] | 0>(0);
  const [hubFeedbackDescription, setHubFeedbackDescription] = useState("");
  const [hubFeedbackBusy, setHubFeedbackBusy] = useState(false);
  const [hubViewFeedbackOpen, setHubViewFeedbackOpen] = useState(false);
  const [hubViewFeedbackData, setHubViewFeedbackData] = useState<{
    id: string;
    display: SupportTicketFeedbackDisplay;
  } | null>(null);
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

  const supportTicketsFiltered = useMemo(() => {
    const filtered = supportTickets.filter((ticket) => {
      const isClosed = isSupportTicketClosedTabStatus(ticket.status ?? null);
      return supportFilter === "open" ? !isClosed : isClosed;
    });
    if (supportFilter === "closed") {
      return [...filtered].sort((a, b) => {
        const pending = (t: SupportTicket) =>
          isSupportTicketInactiveStatus(t.status ?? null) && !supportTicketHasFeedback(t.feedback)
            ? 1
            : 0;
        return pending(b) - pending(a);
      });
    }
    return filtered;
  }, [supportFilter, supportTickets]);

  const supportStatusLabel = useCallback((status: string | null) => {
    const normalized = (status ?? "").trim().toLowerCase();
    if (normalized === "0" || normalized === "created") return "Created";
    if (normalized === "1" || normalized === "active") return "Active";
    if (normalized === "2" || normalized === "Closed") return "Closed";
    if (normalized === "closed") return "Closed";
    if (normalized === "resolved") return "Resolved";
    if (normalized === "completed") return "Completed";
    return status?.trim() || (supportFilter === "open" ? "Open" : "Closed");
  }, [supportFilter]);

  const supportVisibleTickets = useMemo(() => {
    const pageSize = 5;
    return supportTicketsFiltered.slice(0, supportPage * pageSize);
  }, [supportPage, supportTicketsFiltered]);

  const supportHasMore = supportVisibleTickets.length < supportTicketsFiltered.length;

  const supportPendingCount = useMemo(
    () =>
      supportTickets.filter((ticket) => !isSupportTicketClosedTabStatus(ticket.status ?? null)).length,
    [supportTickets],
  );

  const supportClosedCount = useMemo(
    () =>
      supportTickets.filter((ticket) => isSupportTicketClosedTabStatus(ticket.status ?? null)).length,
    [supportTickets],
  );

  const loadSupportTickets = useCallback(async () => {
    setSupportError(null);
    setSupportLoading(true);
    try {
      const tickets = await fetchAllSupportTickets();
      setSupportTickets(tickets);
    } catch (e) {
      setSupportTickets([]);
      setSupportError(e instanceof Error ? e.message : "Could not load tickets");
    } finally {
      setSupportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabId === "help") {
      void loadSupportTickets();
    }
  }, [tabId, loadSupportTickets]);

  useEffect(() => {
    setSupportPage(1);
  }, [supportFilter, supportTicketsFiltered.length]);

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

  const handleLoadMore = useCallback(() => {
    setSupportPage((current) => current + 1);
  }, []);

  const handleRaiseTicket = useCallback(async () => {
    if (!supportMessage.trim()) {
      toast.error("Enter your issue description.");
      return;
    }
    setSupportBusy(true);
    try {
      await createSupportTicket({
        message: supportMessage.trim(),
        language: supportLanguage,
      });
      setSupportDialogOpen(false);
      setSupportMessage("");
      setSupportLanguage("English");
      toast.success("Ticket raised successfully.");
      await loadSupportTickets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not raise ticket");
    } finally {
      setSupportBusy(false);
    }
  }, [supportLanguage, supportMessage, toast, loadSupportTickets]);

  const openHubFeedbackSheet = useCallback((ticketId: string) => {
    setHubFeedbackTicketId(ticketId);
    setHubFeedbackRating(0);
    setHubFeedbackDescription("");
    setHubFeedbackOpen(true);
  }, []);

  const openHubViewFeedback = useCallback((ticket: SupportTicket) => {
    setHubViewFeedbackData({
      id: ticket.id,
      display: parseSupportTicketFeedbackDisplay(ticket.feedback),
    });
    setHubViewFeedbackOpen(true);
  }, []);

  const submitHubFeedback = useCallback(async () => {
    if (!hubFeedbackTicketId) return;
    if (hubFeedbackRating < 1) {
      toast.error("Select a star rating.");
      return;
    }
    if (!hubFeedbackDescription.trim()) {
      toast.error("Enter your feedback.");
      return;
    }
    setHubFeedbackBusy(true);
    try {
      await postSupportFeedback({
        src: "support",
        src_id: hubFeedbackTicketId,
        rating: String(hubFeedbackRating) as "1" | "2" | "3" | "4" | "5",
        description: hubFeedbackDescription.trim(),
      });
      setHubFeedbackOpen(false);
      setHubFeedbackTicketId(null);
      setHubFeedbackRating(0);
      setHubFeedbackDescription("");
      toast.success("Thank you for your feedback.");
      await loadSupportTickets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
    } finally {
      setHubFeedbackBusy(false);
    }
  }, [hubFeedbackDescription, hubFeedbackRating, hubFeedbackTicketId, loadSupportTickets, toast]);

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
            } else if (isMedical) {
              cardAction = () => {
                if (item.id === "appts") {
                  void navigate(generatePath(ROUTES.medicalRecordsCategory, { categorySlug: "consultations" }));
                } else if (item.id === "lab") {
                  void navigate(generatePath(ROUTES.medicalRecordsCategory, { categorySlug: "lab-tests" }));
                } else if (item.id === "rx") {
                  void navigate(generatePath(ROUTES.medicalRecordsCategory, { categorySlug: "prescriptions" }));
                } else if (item.id === "activity") {
                  void navigate(ROUTES.digitalDiary, {
                    state: { returnPath: `${ROUTES.services}?tab=medical-records` },
                  });
                } else {
                  void navigate(ROUTES.medicalRecords);
                }
              };
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
        {tabId === "help" ? (
          <section className="services-hub__support" ref={supportSectionRef}>
            <div className="services-hub__support-header">
              <div>
                <h2>Your Tickets</h2>
                <p>View tickets, raise a new issue, or switch between open and closed requests.</p>
              </div>
              <button
                type="button"
                className="services-hub__support-raise"
                onClick={() => setSupportDialogOpen(true)}
              >
                + Raise Ticket
              </button>
            </div>

            <div className="services-hub__support-tabs">
              <button
                type="button"
                className={`services-hub__support-tab${supportFilter === "open" ? " services-hub__support-tab--active" : ""}`}
                onClick={() => setSupportFilter("open")}
              >
                Open ({supportPendingCount})
              </button>
              <button
                type="button"
                className={`services-hub__support-tab${supportFilter === "closed" ? " services-hub__support-tab--active" : ""}`}
                onClick={() => setSupportFilter("closed")}
              >
                Closed ({supportClosedCount})
              </button>
            </div>

            {supportError ? (
              <div className="services-hub__support-error">{supportError}</div>
            ) : null}

            <div className="services-hub__support-list">
              {supportLoading && (
                <div className="services-hub__support-empty">Loading tickets…</div>
              )}
              {!supportLoading && supportTicketsFiltered.length === 0 && (
                <div className="services-hub__support-empty">
                  No {supportFilter} tickets found.
                </div>
              )}
              {!supportLoading && supportVisibleTickets.length > 0 &&
                supportVisibleTickets.map((ticket) => {
                  const statusText = supportStatusLabel(ticket.status ?? "");
                  const badgeClass = `services-hub__support-badge--${statusText.toLowerCase()}`;
                  const feedbackPending =
                    supportFilter === "closed" &&
                    isSupportTicketInactiveStatus(ticket.status ?? null) &&
                    !supportTicketHasFeedback(ticket.feedback);
                  const hasSavedFeedback = supportTicketHasFeedback(ticket.feedback);
                  return (
                    <div key={ticket.id} className="services-hub__support-card">
                      <div className="services-hub__support-card-row">
                        <button
                          type="button"
                          className="services-hub__support-card-main"
                          onClick={() =>
                            void navigate(
                              generatePath(ROUTES.servicesSupportTicketChat, { ticketId: ticket.id }),
                              { state: { ticketFeedback: ticket.feedback } },
                            )
                          }
                        >
                          <div className="services-hub__support-card-header">
                            <span className="services-hub__support-card-id">{ticket.id} [<span>{ticket.language ?? "English"}</span>]</span>
                            <span className={`services-hub__support-badge ${badgeClass}`}>{statusText}</span>
                          </div>
                          <div className="services-hub__support-card-body">
                            <p className="services-hub__support-card-message">{ticket.message ?? "No message available."}</p>
                            <div className="services-hub__support-card-meta">
                              <span>
                                {ticket.createdAt
                                  ? new Date(ticket.createdAt).toLocaleString("en-IN", {
                                      month: "short",
                                      day: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>
                      {feedbackPending ? (
                        <button
                          type="button"
                          className="services-hub__support-card-provide-feedback"
                          onClick={() => openHubFeedbackSheet(ticket.id)}
                          aria-label="Provide feedback for this ticket"
                        >
                          <span className="services-hub__support-card-provide-feedback-icon" aria-hidden>
                            ★
                          </span>
                          <span>Provide feedback</span>
                        </button>
                      ) : null}
                      {hasSavedFeedback ? (
                        <button
                          type="button"
                          className="services-hub__support-card-view-details"
                          onClick={() => openHubViewFeedback(ticket)}
                        >
                          <span className="services-hub__support-card-view-details-icon" aria-hidden>
                            ★
                          </span>{" "}
                          <span>View feedback details</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              {!supportLoading && supportHasMore && (
                <button
                  type="button"
                  className="services-hub__support-load-more"
                  onClick={handleLoadMore}
                >
                  Load More Tickets
                </button>
              )}
            </div>

            {supportDialogOpen ? (
              <dialog
                className="services-hub__support-sheet-dialog"
                open
                aria-labelledby="support-ticket-title"
              >
                <section className="services-hub__support-sheet">
                  <div className="services-hub__support-dialog-header">
                    <h3 id="support-ticket-title">Raise Support Ticket</h3>
                    <button
                      type="button"
                      className="services-hub__support-dialog-close"
                      onClick={() => setSupportDialogOpen(false)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <label className="services-hub__support-field">
                    <span>Message</span>
                    <textarea
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      rows={4}
                      placeholder="Describe your issue"
                      disabled={supportBusy}
                    />
                  </label>
                  <label className="services-hub__support-field">
                    <span>Language</span>
                    <select
                      value={supportLanguage}
                      onChange={(e) => setSupportLanguage(e.target.value)}
                      disabled={supportBusy}
                    >
                      <option>English</option>
                      <option>Hindi</option>
                      <option>Tamil</option>
                      <option>Telugu</option>
                      <option>Malayalam</option>
                      <option>Kannada</option>
                    </select>
                  </label>
                  <div className="services-hub__support-dialog-actions">
                    <button
                      type="button"
                      className="services-hub__support-dialog-cancel"
                      onClick={() => setSupportDialogOpen(false)}
                      disabled={supportBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="services-hub__support-dialog-submit"
                      onClick={() => void handleRaiseTicket()}
                      disabled={supportBusy}
                    >
                      {supportBusy ? "Raising…" : "Raise Ticket"}
                    </button>
                  </div>
                </section>
              </dialog>
            ) : null}
          </section>
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

      <SupportTicketFeedbackDialog
        open={hubFeedbackOpen}
        ticketIdHint={hubFeedbackTicketId}
        feedbackRating={hubFeedbackRating}
        feedbackDescription={hubFeedbackDescription}
        feedbackBusy={hubFeedbackBusy}
        onRatingChange={setHubFeedbackRating}
        onDescriptionChange={(e) => setHubFeedbackDescription(e.target.value)}
        onClose={() => {
          if (!hubFeedbackBusy) {
            setHubFeedbackOpen(false);
            setHubFeedbackTicketId(null);
          }
        }}
        onSubmit={() => {
          submitHubFeedback().catch(() => {});
        }}
      />

      <SupportTicketFeedbackViewDialog
        open={Boolean(hubViewFeedbackOpen && hubViewFeedbackData)}
        ticketIdHint={hubViewFeedbackData?.id ?? null}
        display={hubViewFeedbackData?.display ?? { rating: null, description: null }}
        onClose={() => {
          setHubViewFeedbackOpen(false);
          setHubViewFeedbackData(null);
        }}
      />
    </div>
  );
}
