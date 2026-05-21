import type { SupportTicket } from "@/api/supportTicket";
import {
  formatSupportTicketDate,
  supportTicketStatusVisual,
} from "@/lib/supportTicketDisplay";
import "./SupportTicketListCard.css";

export type SupportTicketListCardProps = Readonly<{
  ticket: SupportTicket;
  onOpen: () => void;
  onFeedback?: () => void;
  showFeedbackAction?: boolean;
  savedFeedbackRating?: number | null;
}>;

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SupportTicketListCard({
  ticket,
  onOpen,
  onFeedback,
  showFeedbackAction,
  savedFeedbackRating,
}: SupportTicketListCardProps) {
  const visual = supportTicketStatusVisual(ticket.status ?? null);
  const message = ticket.message?.trim() || "No message available.";

  return (
    <article className="support-ticket-card">
      <button type="button" className="support-ticket-card__main" onClick={onOpen}>
        <div className="support-ticket-card__top">
          <span className="support-ticket-card__id-row">
            <span
              className="support-ticket-card__dot"
              style={{ backgroundColor: visual.dotColor }}
              aria-hidden
            />
            <span className="support-ticket-card__id">{ticket.id}</span>
          </span>
          <span
            className="support-ticket-card__badge"
            style={{ color: visual.badgeColor, backgroundColor: visual.badgeBg }}
          >
            {visual.label}
          </span>
        </div>
        <p className="support-ticket-card__message">{message}</p>
        <div className="support-ticket-card__footer">
          <span className="support-ticket-card__date">
            <IconClock />
            {formatSupportTicketDate(ticket.createdAt)}
          </span>
          {savedFeedbackRating != null ? (
            <span className="support-ticket-card__rating" aria-label={`Rated ${savedFeedbackRating} out of 5`}>
              ★ {savedFeedbackRating}/5
            </span>
          ) : null}
        </div>
      </button>
      {showFeedbackAction && onFeedback ? (
        <button type="button" className="support-ticket-card__feedback" onClick={onFeedback}>
          ★ Provide feedback
        </button>
      ) : null}
    </article>
  );
}
