import type { SupportTicketFeedbackDisplay } from "@/api/supportTicket";
import { FEEDBACK_RATINGS, FEEDBACK_RATING_LABELS } from "@/components/support/SupportTicketFeedbackDialog";
import "./SupportFeedbackSheet.css";

export type SupportTicketFeedbackViewDialogProps = Readonly<{
  open: boolean;
  ticketIdHint?: string | null;
  display: SupportTicketFeedbackDisplay;
  onClose: () => void;
}>;

export function SupportTicketFeedbackViewDialog({
  open,
  ticketIdHint,
  display,
  onClose,
}: SupportTicketFeedbackViewDialogProps) {
  if (!open) return null;

  const hasRating = display.rating != null && display.rating >= 1 && display.rating <= 5;
  const desc = display.description?.trim() ?? "";
  const hasDescription = desc.length > 0;
  const hasAny = hasRating || hasDescription;

  const r = display.rating ?? 0;
  const label = hasRating ? FEEDBACK_RATING_LABELS[r] : "";

  return (
    <dialog className="support-chat__feedback-dialog" open aria-labelledby="support-feedback-view-title">
      <section className="support-chat__feedback-sheet support-chat__feedback-sheet--view">
        <div className="support-chat__feedback-handle" aria-hidden />
        <div className="support-chat__feedback-header">
          <h2 id="support-feedback-view-title">Your feedback</h2>
          <button type="button" className="support-chat__feedback-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {ticketIdHint ? (
          <p className="support-chat__feedback-ticket-id" title={ticketIdHint}>
            {ticketIdHint}
          </p>
        ) : null}
        <p className="support-chat__feedback-lead support-chat__feedback-lead--view">Here is what you shared with us.</p>

        {!hasAny ? (
          <p className="support-chat__feedback-empty">We couldn&apos;t load the details for this feedback.</p>
        ) : (
          <div className="support-chat__feedback-view-body">
            {hasRating ? (
              <div className="support-chat__feedback-view-block">
                <span className="support-chat__feedback-section-label">Your rating</span>
                <div
                  className="support-chat__feedback-stars-static"
                  role="img"
                  aria-label={`${r} out of 5 stars${label ? `, ${label}` : ""}`}
                >
                  {FEEDBACK_RATINGS.map((n) => (
                    <span
                      key={n}
                      className={`support-chat__star-static${n <= r ? " support-chat__star-static--on" : ""}`}
                      aria-hidden
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="support-chat__feedback-rating-summary">
                  <span className="support-chat__feedback-rating-num">{r}</span>
                  <span className="support-chat__feedback-rating-out"> / 5</span>
                  {label ? <span className="support-chat__feedback-rating-word">{label}</span> : null}
                </p>
              </div>
            ) : null}

            {hasDescription ? (
              <div className="support-chat__feedback-view-block">
                <span className="support-chat__feedback-section-label">Your comments</span>
                <div className="support-chat__feedback-comment-card">{desc}</div>
              </div>
            ) : null}
          </div>
        )}

        <button type="button" className="support-chat__feedback-done" onClick={onClose}>
          Done
        </button>
      </section>
    </dialog>
  );
}
