import {
  fetchConsultationChatDetail,
  postConsultationChatMessage,
  postConsultationChatUploadPayload,
} from "@/api/patientConsultationChat";
import { uploadSupportDocumentFile } from "@/api/patientUpload";
import {
  isSupportTicketInactiveStatus,
  type SupportTicketDetail,
  type SupportTicketThreadMessage,
} from "@/api/supportTicket";
import {
  SupportTicketChatComposer,
  type SupportChatDraftAttachment,
} from "@/components/support/SupportTicketChatComposer";
import { SupportTicketChatLoadedBody } from "@/components/support/SupportTicketChatLoadedBody";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePath, Link, useParams } from "react-router-dom";
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

function decodeAppointmentParam(raw: string): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function MedicalRecordsConsultationChatPage() {
  const { appointmentId: appointmentIdParam = "" } = useParams<{ appointmentId: string }>();
  const appointmentId = useMemo(() => decodeAppointmentParam(appointmentIdParam), [appointmentIdParam]);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<SupportChatDraftAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const backTo = generatePath(ROUTES.medicalRecordsCategory, { categorySlug: "consultations" });
  const toast = useToast();

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setLoadError(null);
    setLoading(true);
    try {
      const next = await fetchConsultationChatDetail(appointmentId);
      setDetail(next);
    } catch (e) {
      setDetail(null);
      setLoadError(e instanceof Error ? e.message : "Could not load conversation");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadThread = useCallback(async () => {
    if (!appointmentId) return;
    try {
      const next = await fetchConsultationChatDetail(appointmentId);
      setDetail(next);
    } catch {
      toast.error("Could not refresh conversation");
    }
  }, [appointmentId, toast]);

  const isInactive = useMemo(
    () => (detail ? isSupportTicketInactiveStatus(detail.ticket.status) : false),
    [detail],
  );

  const displayMessages = useMemo(() => buildDisplayMessages(detail), [detail]);

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
              await postConsultationChatUploadPayload(appointmentId, uploadResponse);
              setAttachments((prev) => prev.filter((a) => a.id !== id));
              void reloadThread();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Could not send attachment";
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
              return prev.map((a) => (a.id === id ? { ...a, uploading: false, error: msg } : a));
            });
            toast.error(msg);
          });
      }
    },
    [appointmentId, reloadThread, toast],
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
      await postConsultationChatMessage(appointmentId, { message: text });
      setDraft("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }, [attachments, appointmentId, draft, load, toast]);

  const sendDisabled = attachments.some((a) => a.uploading) || !draft.trim();

  if (!appointmentId) {
    return (
      <div className="support-chat">
        <p className="support-chat__centered">Missing appointment.</p>
        <Link to={backTo} className="app-back-btn support-chat__link-back">
          Back to consultations
        </Link>
      </div>
    );
  }

  return (
    <div className="support-chat">
      <header className="support-chat__header">
        <Link to={backTo} className="app-back-btn support-chat__back" aria-label="Back to consultations">
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
          <h1 className="support-chat__title">Consultation</h1>
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

      {!loading && !loadError && detail && isInactive ? (
        <div className="support-chat__readonly-note">This consultation is inactive. Messaging is closed.</div>
      ) : null}
    </div>
  );
}
