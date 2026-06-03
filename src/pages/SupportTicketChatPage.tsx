import {
  SupportTicketChatComposer,
  type SupportChatDraftAttachment,
} from "@/components/support/SupportTicketChatComposer";
import { SupportTicketChatInactiveFooter } from "@/components/support/SupportTicketChatInactiveFooter";
import { SupportTicketChatLoadedBody } from "@/components/support/SupportTicketChatLoadedBody";
import { SupportTicketFeedbackDialog } from "@/components/support/SupportTicketFeedbackDialog";
import {
  fetchSupportTicketDetail,
  parseSupportTicketFeedbackDisplay,
  postSupportTicketMessage,
  postSupportTicketUploadPayload,
  supportTicketHasFeedback,
  type SupportTicketDetail,
  type SupportTicketThreadMessage,
} from "@/api/supportTicket";
import { uploadSupportDocumentFile } from "@/api/patientUpload";
import { SupportTicketFeedbackViewDialog } from "@/components/support/SupportTicketFeedbackViewDialog";
import { ROUTES } from "@/constants";
import { useSupportTicketInactiveFeedback } from "@/hooks/useSupportTicketInactiveFeedback";
import { useToast } from "@/hooks/useToast";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import "./SupportTicketChatPage.css";

function newSupportAttachmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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

interface SupportTicketChatPageLocationState {
  ticketFeedback?: Record<string, unknown> | null;
}

export function SupportTicketChatPage() {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const location = useLocation();
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<SupportChatDraftAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const locationReturn =
    location.state && typeof location.state === "object" && "returnPath" in location.state
      ? (location.state as { returnPath?: unknown }).returnPath
      : undefined;
  const backTo =
    typeof locationReturn === "string" && locationReturn.trim()
      ? locationReturn.trim()
      : ROUTES.servicesHelpSupport;
  const toast = useToast();

  const locationState = location.state as SupportTicketChatPageLocationState | null;
  const locationFeedback = locationState?.ticketFeedback ?? null;

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

  const reloadThread = useCallback(async () => {
    if (!ticketId) return;
    try {
      const next = await fetchSupportTicketDetail(ticketId);
      setDetail(next);
    } catch {
      toast.error("Could not refresh conversation");
    }
  }, [ticketId, toast]);

  const mergedDetail = useMemo(() => {
    if (!detail) return null;
    if (supportTicketHasFeedback(detail.ticket.feedback)) return detail;
    if (locationFeedback && supportTicketHasFeedback(locationFeedback)) {
      return {
        ...detail,
        ticket: {
          ...detail.ticket,
          feedback: locationFeedback,
        },
      };
    }
    return detail;
  }, [detail, locationFeedback]);

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
  } = useSupportTicketInactiveFeedback(ticketId, mergedDetail, load, toast);

  const displayMessages = useMemo(() => buildDisplayMessages(detail), [detail]);

  const [viewFeedbackOpen, setViewFeedbackOpen] = useState(false);

  const submittedFeedbackDisplay = useMemo(
    () => (mergedDetail ? parseSupportTicketFeedbackDisplay(mergedDetail.ticket.feedback) : { rating: null, description: null }),
    [mergedDetail],
  );

  const canViewSubmittedFeedback = Boolean(
    mergedDetail && isInactive && supportTicketHasFeedback(mergedDetail.ticket.feedback) && !needsSupportFeedback,
  );

  // If feedback exists, show it in the dialog instead of separate view
  const existingFeedback = canViewSubmittedFeedback
    ? parseSupportTicketFeedbackDisplay(mergedDetail!.ticket.feedback)
    : null;

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayMessages.length, sending]);

  const statusLabel = detail ? formatTicketStatus(detail.ticket.status ?? null) : "";
  const statusBadgeModifier = statusLabel.toLowerCase().replaceAll(/\s+/g, "-");
  const statusBadgeClass = detail
    ? `support-chat__badge support-chat__badge--${statusBadgeModifier}`
    : "";

  const onPickFiles = useCallback(() => fileInputRef.current?.click(), []);

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list?.length) return;
      const picked = Array.from(list);
      e.target.value = "";

      for (const file of picked) {
        const id = newSupportAttachmentId();
        setAttachments((prev) => [...prev, { id, fileName: file.name, uploading: true, error: null }]);

        void uploadSupportDocumentFile(file)
          .then(async (uploadResponse) => {
            try {
              await postSupportTicketUploadPayload(ticketId, uploadResponse);
              setAttachments((prev) => prev.filter((a) => a.id !== id));
              void reloadThread();
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Could not send attachment";
              setAttachments((prev) => {
                if (!prev.some((a) => a.id === id)) return prev;
                return prev.map((a) => (a.id === id ? { ...a, uploading: false, error: msg } : a));
              });
              toast.error(msg);
            }
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : "Upload failed";
            setAttachments((prev) => {
              if (!prev.some((a) => a.id === id)) return prev;
              return prev.map((a) =>
                a.id === id ? { ...a, uploading: false, error: msg } : a,
              );
            });
            toast.error(msg);
          });
      }
    },
    [reloadThread, ticketId, toast],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (attachments.some((a) => a.uploading)) {
      toast.error("Wait for attachments to finish sending.");
      return;
    }
    if (!text) {
      toast.error("Type a message to send, or attach a file.");
      return;
    }
    setSending(true);
    try {
      await postSupportTicketMessage(ticketId, { message: text });
      setDraft("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }, [attachments, draft, load, ticketId, toast]);

  const sendDisabled = attachments.some((a) => a.uploading) || !draft.trim();

  if (!ticketId) {
    return (
      <div className="support-chat">
        <p className="support-chat__centered">Missing ticket.</p>
        <Link to={backTo} className="app-back-btn support-chat__link-back">
          Back to Help
        </Link>
      </div>
    );
  }

  return (
    <div className="support-chat">
      <header className="support-chat__header">
        <Link to={backTo} className="app-back-btn support-chat__back" aria-label="Back to help">
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
          attachments={attachments}
          draft={draft}
          sending={sending}
          sendDisabled={sendDisabled}
          onPickFiles={onPickFiles}
          onFileChange={onFileChange}
          onRemoveAttachment={removeAttachment}
          onDraftChange={setDraft}
          onSend={() => {
            send().catch(() => {});
          }}
        />
      ) : null}

      <SupportTicketChatInactiveFooter
        loading={loading}
        loadError={loadError}
        detail={mergedDetail}
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
        open={Boolean(feedbackOpen && mergedDetail)}
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
        existingFeedback={existingFeedback}
      />
    </div>
  );
}
