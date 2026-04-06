import { postSupportFeedback } from "@/api/patientFeedback";
import {
  isSupportTicketInactiveStatus,
  supportTicketHasFeedback,
  type SupportTicketDetail,
} from "@/api/supportTicket";
import { FEEDBACK_RATINGS } from "@/components/support/SupportTicketFeedbackDialog";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Rating = (typeof FEEDBACK_RATINGS)[number] | 0;

export function useSupportTicketInactiveFeedback(
  ticketId: string,
  detail: SupportTicketDetail | null,
  load: () => Promise<void>,
  toast: { error: (m: string) => void; success: (m: string) => void },
): Readonly<{
  isInactive: boolean;
  needsSupportFeedback: boolean;
  feedbackOpen: boolean;
  setFeedbackOpen: Dispatch<SetStateAction<boolean>>;
  feedbackRating: Rating;
  setFeedbackRating: Dispatch<SetStateAction<Rating>>;
  feedbackDescription: string;
  setFeedbackDescription: Dispatch<SetStateAction<string>>;
  feedbackBusy: boolean;
  submitFeedback: () => Promise<void>;
}> {
  const feedbackAutoOpenedForId = useRef<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<Rating>(0);
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const isInactive = useMemo(
    () => (detail ? isSupportTicketInactiveStatus(detail.ticket.status) : false),
    [detail],
  );

  const needsSupportFeedback = useMemo(
    () =>
      Boolean(
        detail &&
          isSupportTicketInactiveStatus(detail.ticket.status) &&
          !supportTicketHasFeedback(detail.ticket.feedback),
      ),
    [detail],
  );

  useEffect(() => {
    feedbackAutoOpenedForId.current = null;
  }, [ticketId]);

  useEffect(() => {
    if (!needsSupportFeedback || !ticketId) return;
    if (feedbackAutoOpenedForId.current === ticketId) return;
    feedbackAutoOpenedForId.current = ticketId;
    setFeedbackOpen(true);
  }, [needsSupportFeedback, ticketId]);

  const submitFeedback = useCallback(async () => {
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
        src_id: ticketId,
        rating: String(feedbackRating) as "1" | "2" | "3" | "4" | "5",
        description: feedbackDescription.trim(),
      });
      setFeedbackOpen(false);
      setFeedbackRating(0);
      setFeedbackDescription("");
      toast.success("Thank you for your feedback.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
    } finally {
      setFeedbackBusy(false);
    }
  }, [feedbackDescription, feedbackRating, load, ticketId, toast]);

  return {
    isInactive,
    needsSupportFeedback,
    feedbackOpen,
    setFeedbackOpen,
    feedbackRating,
    setFeedbackRating,
    feedbackDescription,
    setFeedbackDescription,
    feedbackBusy,
    submitFeedback,
  };
}
