import type { SupportTicketDetail } from "@/api/supportTicket";

export type SupportTicketChatInactiveFooterProps = Readonly<{
  loading: boolean;
  loadError: string | null;
  detail: SupportTicketDetail | null;
  isInactive: boolean;
  needsSupportFeedback: boolean;
  feedbackOpen: boolean;
  onOpenFeedback: () => void;
  canViewSubmittedFeedback: boolean;
  onViewFeedback: () => void;
}>;

export function SupportTicketChatInactiveFooter({
  loading,
  loadError,
  detail,
  isInactive,
  needsSupportFeedback,
  feedbackOpen,
  onOpenFeedback,
  canViewSubmittedFeedback,
  onViewFeedback,
}: SupportTicketChatInactiveFooterProps) {
  if (loading || loadError || !detail || !isInactive) return null;

  if (needsSupportFeedback && !feedbackOpen) {
    return (
      <div className="support-chat__inactive-cta">
        <p className="support-chat__inactive-cta-text">
          This ticket is inactive. Please rate your experience — both rating and comments are required.
        </p>
        <button type="button" className="support-chat__inactive-cta-btn" onClick={onOpenFeedback}>
          Rate and submit feedback
        </button>
      </div>
    );
  }

  if (!needsSupportFeedback && canViewSubmittedFeedback) {
    return (
      <div className="support-chat__inactive-summary">
        <p className="support-chat__readonly-note support-chat__readonly-note--inline">
          This ticket is inactive. Messaging is closed.
        </p>
        <button type="button" className="support-chat__view-feedback-link" onClick={onViewFeedback}>
          <span className="support-chat__view-feedback-link-icon" aria-hidden>
            ★
          </span>{" "}
          <span>View feedback details</span>
        </button>
      </div>
    );
  }

  if (!needsSupportFeedback) {
    return <div className="support-chat__readonly-note">This ticket is inactive. Messaging is closed.</div>;
  }

  return null;
}
