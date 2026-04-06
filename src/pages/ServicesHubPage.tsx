import { ServiceHubCard } from "@/components/services/ServiceHubCard";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  getHubHeading,
  getHubItems,
  HUB_TABS,
  isHubTabId,
  type HubTabId,
} from "@/constants/servicesHubContent";
import { ROUTES } from "@/constants";
import { ChangePasswordModal, DeleteAccountModal } from "@/components/profile";
import { changePatientPassword } from "@/api/patientPassword";
import { requestProfileDeletion } from "@/api/patientProfileDelete";
import { useToast } from "@/hooks/useToast";
import {
  createSupportTicket,
  fetchSupportTickets,
  type SupportTicket,
} from "@/api/supportTicket";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

  const setTab = useCallback(
    (id: HubTabId) => {
      setSearchParams({ tab: id }, { replace: true });
    },
    [setSearchParams],
  );

  const items = getHubItems(tabId);
  const heading = getHubHeading(tabId);
  // Use 2 columns so cards can match the larger tile style consistently.
  const gridCols = 2;

  const [medicalSelectedId, setMedicalSelectedId] = useState("lab");

  const supportTicketsFiltered = useMemo(
    () =>
      supportTickets.filter((ticket) => {
        const status = (ticket.status ?? "").trim().toLowerCase();
        const isClosed = status === "closed" || status === "resolved" || status === "completed";
        return supportFilter === "open" ? !isClosed : isClosed;
      }),
    [supportFilter, supportTickets],
  );

  const supportStatusLabel = useCallback((status: string | null) => {
    const normalized = (status ?? "").trim().toLowerCase();
    if (normalized === "0" || normalized === "created") return "Created";
    if (normalized === "1" || normalized === "active") return "Active";
    if (normalized === "2" || normalized === "inactive") return "Inactive";
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
      supportTickets.filter((ticket) => {
        const status = (ticket.status ?? "").trim().toLowerCase();
        return status !== "closed" && status !== "resolved" && status !== "completed";
      }).length,
    [supportTickets],
  );

  const supportClosedCount = useMemo(
    () =>
      supportTickets.filter((ticket) => {
        const status = (ticket.status ?? "").trim().toLowerCase();
        return status === "closed" || status === "resolved" || status === "completed";
      }).length,
    [supportTickets],
  );

  const loadSupportTickets = useCallback(async () => {
    setSupportError(null);
    setSupportLoading(true);
    try {
      const tickets = await fetchSupportTickets();
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
                  return (
                    <article key={ticket.id} className="services-hub__support-card">
                      <div className="services-hub__support-card-header">
                        <span className="services-hub__support-card-id">{ticket.id} [<span>{ticket.language ?? "English"}</span>]</span>
                        <span className={`services-hub__support-badge ${badgeClass}`}>{statusText}</span>
                      </div>
                      <div className="services-hub__support-card-body">
                        <p className="services-hub__support-card-message">{ticket.message ?? "No message available."}</p>
                        <div className="services-hub__support-card-meta">
                         
                          <span>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("en-IN", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                      </div>
                    </article>
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
    </div>
  );
}
