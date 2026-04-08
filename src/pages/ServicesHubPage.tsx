import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  getHubHeading,
  getHubItems,
  HUB_TABS,
  isHubTabId,
  type HubTabId,
} from "@/constants/servicesHubContent";
import { ROUTES, WELLNESS_SESSION_KIND } from "@/constants";
import { SupportTicketFeedbackViewDialog } from "@/components/support/SupportTicketFeedbackViewDialog";
import { SupportTicketFeedbackDialog, FEEDBACK_RATINGS } from "@/components/support/SupportTicketFeedbackDialog";
import { ChangePasswordModal, DeleteAccountModal } from "@/components/profile";
import { postSupportFeedback } from "@/api/patientFeedback";
import { changePatientPassword } from "@/api/patientPassword";
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
    case "password":
      return null; // modal
    case "delete":
      return null; // modal
    case "invoices":
      return ROUTES.profileSubscriptions; // or specific
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

  const navigate = useNavigate();
  const toast = useToast();
  const supportSectionRef = useRef<HTMLDivElement | null>(null);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
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

  const setTab = useCallback(
    (id: HubTabId) => {
      setSearchParams({ tab: id }, { replace: true });
    },
    [setSearchParams],
  );

  const items = getHubItems(tabId);
  const heading = getHubHeading(tabId);
  // Help tab: 4-column grid; other tabs keep the shared hub layout.
  const gridCols = tabId === "help" ? 4 : 2;

  const [medicalSelectedId, setMedicalSelectedId] = useState("lab");

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
          {HUB_TABS.map(({ id, label, Icon, iconSrc }) => {
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
        <div
          className={`service-hub-grid service-hub-grid--cols-${gridCols}`}
        >
          {items.map((item) => {
            const Icon = item.Icon;
            const isMedical = tabId === "medical-records";
            const selected = isMedical && medicalSelectedId === item.id;

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

            const isHelpSupportCard = tabId === "help" && item.id === "support";
            let cardAction: (() => void) | undefined;
            if (isHelpSupportCard) {
              cardAction = () => supportSectionRef.current?.scrollIntoView({ behavior: "smooth" });
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
            } else if (tabId === "services" && item.id === "pharm") {
              cardAction = () => {
                void navigate(ROUTES.pharmacy, {
                  state: { returnPath: `${ROUTES.services}?tab=services` },
                });
              };
            } else if (tabId === "account") {
              cardAction = () => {
                const route = getAccountRoute(item.id);
                if (route) {
                  void navigate(route, { state: { returnPath: `${ROUTES.services}?tab=account` } });
                } else if (item.id === "password") {
                  setChangePasswordOpen(true);
                } else if (item.id === "delete") {
                  setDeleteAccountOpen(true);
                }
              };
            } else if (isMedical) {
              cardAction = () => setMedicalSelectedId(item.id);
            }

            return (
              <ServiceHubCard
                key={item.id}
                icon={iconNode}
                title={item.title}
                description={item.description}
                badge={item.badge}
                selected={selected}
                onClick={cardAction}
              />
            );
          })}
        </div>
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

      <HomeBottomNav />

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={async ({ oldPassword, newPassword, confirmPassword }) => {
          await changePatientPassword({
            current_password: oldPassword,
            new_password: newPassword,
            confirmation_password: confirmPassword,
          });
          toast.success("Password changed successfully.");
        }}
      />
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
