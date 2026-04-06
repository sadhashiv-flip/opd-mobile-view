import { SupportTicketChatComposer } from "@/components/support/SupportTicketChatComposer";
import { SupportTicketChatInactiveFooter } from "@/components/support/SupportTicketChatInactiveFooter";
import { SupportTicketChatLoadedBody } from "@/components/support/SupportTicketChatLoadedBody";
import { SupportTicketFeedbackDialog } from "@/components/support/SupportTicketFeedbackDialog";
import {
  fetchSupportTicketDetail,
  parseSupportTicketFeedbackDisplay,
  postSupportTicketMessage,
  supportTicketHasFeedback,
  type SupportTicketDetail,
  type SupportTicketThreadMessage,
} from "@/api/supportTicket";
import { SupportTicketFeedbackViewDialog } from "@/components/support/SupportTicketFeedbackViewDialog";
import { ROUTES } from "@/constants";
import { useSupportTicketInactiveFeedback } from "@/hooks/useSupportTicketInactiveFeedback";
import { useToast } from "@/hooks/useToast";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./SupportTicketChatPage.css";

function formatTicketStatus(status: string | null): string {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "0" || normalized === "created") return "Created";
  if (normalized === "1" || normalized === "active") return "Active";
  if (normalized === "2" || normalized === "inactive") return "Inactive";
  if (normalized === "closed") return "Closed";
  if (normalized === "resolved") return "Resolved";
  if (normalized === "completed") return "Completed";
  return status?.trim() || "Open";
}

function buildDisplayMessages(detail: SupportTicketDetail | null): SupportTicketThreadMessage[] {
  if (!detail) return [];
  const { ticket, messages } = detail;
  if (messages.length > 0) return messages;
  const issue = ticket.message?.trim() ?? "";
  if (issue.length > 0) {
    return [
      {
        id: "ticket-issue",
        text: issue,
        createdAt: ticket.createdAt,
        outgoing: true,
        senderName: null,
        messageType: null,
        attachments: [],
      },
    ];
  }
  return [];
}

export function SupportTicketChatPage() {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const backTo = ROUTES.servicesHelpTab;
  const toast = useToast();

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoadError(null);
    setLoading(true);
    try {
      const next = await fetchSupportTicketDetail(ticketId);
      setDetail(next);
    } catch (e) {
      setDetail(null);
      setLoadError(e instanceof Error ? e.message : "Could not load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
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
  } = useSupportTicketInactiveFeedback(ticketId, detail, load, toast);

  const displayMessages = useMemo(() => buildDisplayMessages(detail), [detail]);

  const [viewFeedbackOpen, setViewFeedbackOpen] = useState(false);

  const submittedFeedbackDisplay = useMemo(
    () => (detail ? parseSupportTicketFeedbackDisplay(detail.ticket.feedback) : { rating: null, description: null }),
    [detail],
  );

  const canViewSubmittedFeedback = Boolean(
    detail && isInactive && supportTicketHasFeedback(detail.ticket.feedback) && !needsSupportFeedback,
  );

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayMessages.length, sending]);

  const statusLabel = detail ? formatTicketStatus(detail.ticket.status ?? null) : "";
  const statusBadgeModifier = statusLabel.toLowerCase().replaceAll(/\s+/g, "-");
  const statusBadgeClass = detail
    ? `support-chat__badge support-chat__badge--${statusBadgeModifier}`
    : "";

  const onPickFiles = useCallback(() => fileInputRef.current?.click(), []);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    e.target.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text && files.length === 0) {
      toast.error("Type a message or attach a file.");
      return;
    }
    setSending(true);
    try {
      await postSupportTicketMessage(ticketId, { message: text, files: files.length ? files : undefined });
      setDraft("");
      setFiles([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }, [draft, files, load, ticketId, toast]);

  if (!ticketId) {
    return (
      <div className="support-chat">
        <p className="support-chat__centered">Missing ticket.</p>
        <Link to={backTo} className="support-chat__link-back">
          Back to Help
        </Link>
      </div>
    );
  }

  return (
    <div className="support-chat">
      <header className="support-chat__header">
        <Link to={backTo} className="support-chat__back" aria-label="Back to help">
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
        <div className="support-chat__header-text">
          <h1 className="support-chat__title">Support</h1>
          {!loading && !loadError && detail ? (
            <div className="support-chat__header-meta">
              <span className="support-chat__header-id" title={detail.ticket.id}>
                {detail.ticket.id}
              </span>
              <span className={statusBadgeClass}>{statusLabel}</span>
            </div>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="support-chat__centered support-chat__muted">Loading conversation…</div>
      ) : null}

      {loadError ? <div className="support-chat__error">{loadError}</div> : null}

      {!loading && !loadError && detail ? (
        <SupportTicketChatLoadedBody detail={detail} displayMessages={displayMessages} listEndRef={listEndRef} />
      ) : null}

      {!loading && !loadError && detail && !isInactive ? (
        <SupportTicketChatComposer
          fileInputRef={fileInputRef}
          files={files}
          draft={draft}
          sending={sending}
          onPickFiles={onPickFiles}
          onFileChange={onFileChange}
          onRemoveFile={removeFile}
          onDraftChange={setDraft}
          onSend={() => {
            send().catch(() => {});
          }}
        />
      ) : null}

      <SupportTicketChatInactiveFooter
        loading={loading}
        loadError={loadError}
        detail={detail}
        isInactive={isInactive}
        needsSupportFeedback={needsSupportFeedback}
        feedbackOpen={feedbackOpen}
        onOpenFeedback={() => setFeedbackOpen(true)}
        canViewSubmittedFeedback={canViewSubmittedFeedback}
        onViewFeedback={() => setViewFeedbackOpen(true)}
      />

      <SupportTicketFeedbackViewDialog
        open={viewFeedbackOpen}
        ticketIdHint={ticketId}
        display={submittedFeedbackDisplay}
        onClose={() => setViewFeedbackOpen(false)}
      />

      <SupportTicketFeedbackDialog
        open={Boolean(feedbackOpen && detail)}
        ticketIdHint={ticketId}
        feedbackRating={feedbackRating}
        feedbackDescription={feedbackDescription}
        feedbackBusy={feedbackBusy}
        onRatingChange={setFeedbackRating}
        onDescriptionChange={(e) => setFeedbackDescription(e.target.value)}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={() => {
          submitFeedback().catch(() => {});
        }}
      />
    </div>
  );
}
