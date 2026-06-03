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
import { postSupportFeedback } from "@/api/patientFeedback";
import { SupportTicketListCard } from "@/components/support/SupportTicketListCard";
import { SupportTicketFeedbackDialog, FEEDBACK_RATINGS } from "@/components/support/SupportTicketFeedbackDialog";
import { SupportTicketFeedbackViewDialog } from "@/components/support/SupportTicketFeedbackViewDialog";
import { AppBackChevron } from "@/components/navigation/AppBackChevron";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { isHelpSupportFromBottomNav, type HelpSupportLocationState } from "@/lib/helpSupportEntry";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import "./HelpSupportTicketsPage.css";

const SUPPORT_LANGUAGES = [
  "English",
  "Hindi",
  "Telugu",
  "Kannada",
  "Tamil",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
] as const;

export function HelpSupportTicketsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const navState = location.state as HelpSupportLocationState | null;
  const fromBottomNav = isHelpSupportFromBottomNav(navState);
  const showBottomNav = fromBottomNav;

  const returnPath = navState?.returnPath?.trim() || ROUTES.servicesHelpTab;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseMessage, setRaiseMessage] = useState("");
  const [raiseLanguage, setRaiseLanguage] = useState<string>(SUPPORT_LANGUAGES[0]);
  const [raiseBusy, setRaiseBusy] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTicketId, setFeedbackTicketId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<(typeof FEEDBACK_RATINGS)[number] | 0>(0);
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [viewFeedbackOpen, setViewFeedbackOpen] = useState(false);
  const [viewFeedbackData, setViewFeedbackData] = useState<{
    id: string;
    display: SupportTicketFeedbackDisplay;
  } | null>(null);

  const loadTickets = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const next = await fetchAllSupportTickets();
      setTickets(next);
    } catch (e) {
      setTickets([]);
      setError(e instanceof Error ? e.message : "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const openCount = useMemo(
    () => tickets.filter((t) => !isSupportTicketClosedTabStatus(t.status ?? null)).length,
    [tickets],
  );

  const closedCount = useMemo(
    () => tickets.filter((t) => isSupportTicketClosedTabStatus(t.status ?? null)).length,
    [tickets],
  );

  const visibleTickets = useMemo(() => {
    const filtered = tickets.filter((ticket) => {
      const isClosed = isSupportTicketClosedTabStatus(ticket.status ?? null);
      return filter === "open" ? !isClosed : isClosed;
    });
    if (filter === "closed") {
      return [...filtered].sort((a, b) => {
        const pending = (t: SupportTicket) =>
          isSupportTicketInactiveStatus(t.status ?? null) && !supportTicketHasFeedback(t.feedback)
            ? 1
            : 0;
        return pending(b) - pending(a);
      });
    }
    return filtered;
  }, [filter, tickets]);

  const handleBack = useCallback(() => {
    void navigate(returnPath);
  }, [navigate, returnPath]);

  const handleRaiseTicket = useCallback(async () => {
    if (!raiseMessage.trim()) {
      toast.error("Please describe your issue.");
      return;
    }
    setRaiseBusy(true);
    try {
      await createSupportTicket({
        message: raiseMessage.trim(),
        language: raiseLanguage,
      });
      setRaiseOpen(false);
      setRaiseMessage("");
      setRaiseLanguage(SUPPORT_LANGUAGES[0]);
      toast.success("Ticket raised successfully.");
      await loadTickets();
      setFilter("open");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not raise ticket");
    } finally {
      setRaiseBusy(false);
    }
  }, [loadTickets, raiseLanguage, raiseMessage, toast]);

  const openFeedback = useCallback((ticketId: string) => {
    setFeedbackTicketId(ticketId);
    setFeedbackRating(0);
    setFeedbackDescription("");
    setFeedbackOpen(true);
  }, []);

  const submitFeedback = useCallback(async () => {
    if (!feedbackTicketId) return;
    if (feedbackRating < 1) {
      toast.error("Select a star rating.");
      return;
    }
    if (!feedbackDescription.trim()) {
      toast.error("Enter your feedback.");
      return;
    }
    setFeedbackBusy(true);
    try {
      await postSupportFeedback({
        src: "support",
        src_id: feedbackTicketId,
        rating: String(feedbackRating) as "1" | "2" | "3" | "4" | "5",
        description: feedbackDescription.trim(),
      });
      setFeedbackOpen(false);
      setFeedbackTicketId(null);
      setFeedbackRating(0);
      setFeedbackDescription("");
      toast.success("Thank you for your feedback.");
      await loadTickets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
    } finally {
      setFeedbackBusy(false);
    }
  }, [feedbackDescription, feedbackRating, feedbackTicketId, loadTickets, toast]);

  return (
    <div
      className={`help-support-tickets${showBottomNav ? " help-support-tickets--with-nav" : ""}`}
    >
      <header
        className={`help-support-tickets__top${fromBottomNav ? " help-support-tickets__top--tab-entry" : ""}`}
      >
        {fromBottomNav ? null : (
          <button
            type="button"
            onClick={handleBack}
            className="app-back-btn help-support-tickets__back"
            aria-label="Back"
          >
            <AppBackChevron />
          </button>
        )}
        <h1 className="help-support-tickets__title">Help &amp; Support</h1>
        <span className="help-support-tickets__spacer" aria-hidden />
      </header>

      <main className="help-support-tickets__main">
        <h2 className="help-support-tickets__section-title">Your Tickets</h2>

        <div className="help-support-tickets__segment" role="tablist" aria-label="Ticket filter">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "open"}
            className={`help-support-tickets__segment-btn${filter === "open" ? " help-support-tickets__segment-btn--active" : ""}`}
            onClick={() => setFilter("open")}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "closed"}
            className={`help-support-tickets__segment-btn${filter === "closed" ? " help-support-tickets__segment-btn--active" : ""}`}
            onClick={() => setFilter("closed")}
          >
            Closed ({closedCount})
          </button>
        </div>

        {error ? <div className="help-support-tickets__empty">{error}</div> : null}

        {loading ? (
          <div className="help-support-tickets__empty">Loading tickets…</div>
        ) : null}

        {!loading && !error && visibleTickets.length === 0 ? (
          <div className="help-support-tickets__empty">
            {filter === "open" ? "No active tickets" : "No closed tickets"}
          </div>
        ) : null}

        {!loading && visibleTickets.length > 0 ? (
          <ul className="help-support-tickets__list">
            {visibleTickets.map((ticket) => {
              const feedbackPending =
                filter === "closed" &&
                isSupportTicketInactiveStatus(ticket.status ?? null) &&
                !supportTicketHasFeedback(ticket.feedback);
              const hasSavedFeedback = supportTicketHasFeedback(ticket.feedback);
              const savedRating = hasSavedFeedback
                ? parseSupportTicketFeedbackDisplay(ticket.feedback).rating
                : null;

              return (
                <li key={ticket.id}>
                  <SupportTicketListCard
                    ticket={ticket}
                    onOpen={() =>
                      void navigate(
                        generatePath(ROUTES.servicesSupportTicketChat, { ticketId: ticket.id }),
                        {
                          state: {
                            ticketFeedback: ticket.feedback,
                            returnPath: ROUTES.servicesHelpSupport,
                            fromBottomNav,
                          },
                        },
                      )
                    }
                    showFeedbackAction={feedbackPending}
                    onFeedback={() => openFeedback(ticket.id)}
                    savedFeedbackRating={savedRating}
                  />
                  {hasSavedFeedback ? (
                    <button
                      type="button"
                      className="help-support-tickets__view-feedback"
                      onClick={() => {
                        setViewFeedbackData({
                          id: ticket.id,
                          display: parseSupportTicketFeedbackDisplay(ticket.feedback),
                        });
                        setViewFeedbackOpen(true);
                      }}
                    >
                      View feedback details
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>

      <button
        type="button"
        className="help-support-tickets__fab"
        onClick={() => setRaiseOpen(true)}
      >
        <span className="help-support-tickets__fab-icon" aria-hidden>
          +
        </span>
        Raise Ticket
      </button>

      {raiseOpen ? (
        <dialog
          className="help-support-tickets__sheet-dialog"
          open
          onClick={(e) => {
            if (e.target === e.currentTarget && !raiseBusy) setRaiseOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !raiseBusy) setRaiseOpen(false);
          }}
        >
          <section className="help-support-tickets__sheet" aria-labelledby="raise-ticket-title">
            <div className="help-support-tickets__sheet-handle" aria-hidden />
            <div className="help-support-tickets__sheet-header">
              <h3 id="raise-ticket-title">Open a ticket</h3>
              <p>Our team will get back to you as soon as possible.</p>
            </div>
            <label className="help-support-tickets__field">
              <span>Describe your issue</span>
              <textarea
                value={raiseMessage}
                onChange={(e) => setRaiseMessage(e.target.value)}
                rows={4}
                placeholder="Tell us what you need help with"
                disabled={raiseBusy}
              />
            </label>
            <label className="help-support-tickets__field">
              <span>Preferred language to speak in ticket</span>
              <select
                value={raiseLanguage}
                onChange={(e) => setRaiseLanguage(e.target.value)}
                disabled={raiseBusy}
              >
                {SUPPORT_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>
            <div className="help-support-tickets__sheet-actions">
              <button
                type="button"
                className="help-support-tickets__sheet-cancel"
                onClick={() => setRaiseOpen(false)}
                disabled={raiseBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="help-support-tickets__sheet-submit"
                onClick={() => void handleRaiseTicket()}
                disabled={raiseBusy || !raiseMessage.trim()}
              >
                {raiseBusy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </section>
        </dialog>
      ) : null}

      <SupportTicketFeedbackDialog
        open={feedbackOpen}
        ticketIdHint={feedbackTicketId}
        feedbackRating={feedbackRating}
        feedbackDescription={feedbackDescription}
        feedbackBusy={feedbackBusy}
        onRatingChange={setFeedbackRating}
        onDescriptionChange={(e) => setFeedbackDescription(e.target.value)}
        onClose={() => {
          if (!feedbackBusy) {
            setFeedbackOpen(false);
            setFeedbackTicketId(null);
          }
        }}
        onSubmit={() => {
          void submitFeedback();
        }}
      />

      <SupportTicketFeedbackViewDialog
        open={Boolean(viewFeedbackOpen && viewFeedbackData)}
        ticketIdHint={viewFeedbackData?.id ?? null}
        display={viewFeedbackData?.display ?? { rating: null, description: null }}
        onClose={() => {
          setViewFeedbackOpen(false);
          setViewFeedbackData(null);
        }}
      />

      {showBottomNav ? <HomeBottomNav /> : null}
    </div>
  );
}
