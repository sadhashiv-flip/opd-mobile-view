import type { ChangeEvent } from "react";
import "./SupportFeedbackSheet.css";

export const FEEDBACK_RATINGS = [1, 2, 3, 4, 5] as const;

/** Index 1–5 = label for that star count */
export const FEEDBACK_RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;

export type SupportTicketFeedbackDialogProps = Readonly<{
  open: boolean;
  /** Shown under the title when set (e.g. ticket id from hub list). */
  ticketIdHint?: string | null;
  feedbackRating: (typeof FEEDBACK_RATINGS)[number] | 0;
  feedbackDescription: string;
  feedbackBusy: boolean;
  onRatingChange: (n: (typeof FEEDBACK_RATINGS)[number]) => void;
  onDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onClose: () => void;
  onSubmit: () => void;
}>;

export function SupportTicketFeedbackDialog({
  open,
  ticketIdHint,
  feedbackRating,
  feedbackDescription,
  feedbackBusy,
  onRatingChange,
  onDescriptionChange,
  onClose,
  onSubmit,
}: SupportTicketFeedbackDialogProps) {
  if (!open) return null;

  const summaryLabel =
    feedbackRating > 0 && feedbackRating <= 5 ? FEEDBACK_RATING_LABELS[feedbackRating] : "";

  return (
    <dialog className="support-chat__feedback-dialog" open aria-labelledby="support-feedback-title">
      <section className="support-chat__feedback-sheet support-chat__feedback-sheet--submit">
        <div className="support-chat__feedback-handle" aria-hidden />
        <div className="support-chat__feedback-header">
          <h2 id="support-feedback-title">Rate support</h2>
          <button
            type="button"
            className="support-chat__feedback-close"
            onClick={onClose}
            disabled={feedbackBusy}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {ticketIdHint ? (
          <p className="support-chat__feedback-ticket-id" title={ticketIdHint}>
            {ticketIdHint}
          </p>
        ) : null}
        <p className="support-chat__feedback-lead">How was your experience with this ticket? Both a star rating and a short note are required.</p>
        <div className="support-chat__feedback-field">
          <span className="support-chat__feedback-section-label" id="support-feedback-rating-label">
            Tap a star to rate
          </span>
          <div className="support-chat__stars feedback-stars" role="radiogroup" aria-labelledby="support-feedback-rating-label">
            {FEEDBACK_RATINGS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                className={`support-chat__star${feedbackRating >= n ? " support-chat__star--on" : ""}`}
                onClick={() => onRatingChange(n)}
                disabled={feedbackBusy}
                aria-label={`${n} out of 5 stars`}
                aria-checked={feedbackRating === n}
              >
                ★
              </button>
            ))}
          </div>
          {feedbackRating > 0 ? (
            <p className="support-chat__feedback-selected-summary" aria-live="polite">
              <strong>{feedbackRating}</strong> of 5 · {summaryLabel}
            </p>
          ) : (
            <p className="support-chat__feedback-star-hint">Choose 1 (lowest) through 5 (best).</p>
          )}
        </div>
        <label className="support-chat__feedback-field support-chat__feedback-field--block">
          <span className="support-chat__feedback-section-label">Comments (required)</span>
          <span className="support-chat__feedback-microcopy">Share what went well or what we can improve.</span>
          <textarea
            className="support-chat__feedback-textarea"
            rows={4}
            value={feedbackDescription}
            onChange={onDescriptionChange}
            placeholder="e.g. Response was quick and helpful…"
            disabled={feedbackBusy}
            required
          />
        </label>
        <div className="support-chat__feedback-actions support-chat__feedback-actions--stack">
          <button type="button" className="support-chat__feedback-submit" onClick={onSubmit} disabled={feedbackBusy}>
            {feedbackBusy ? "Submitting…" : "Submit feedback"}
          </button>
          <button type="button" className="support-chat__feedback-cancel support-chat__feedback-cancel--ghost" onClick={onClose} disabled={feedbackBusy}>
            Not now
          </button>
        </div>
      </section>
    </dialog>
  );
}
