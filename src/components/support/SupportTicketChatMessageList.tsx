import type { SupportTicketThreadMessage } from "@/api/supportTicket";
import { SupportChatPdfViewer } from "@/components/support/SupportChatPdfViewer";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useId, useState } from "react";

function isImageAttachment(url: string, mime: string | null, messageType: string | null): boolean {
  if ((messageType ?? "").toUpperCase() === "IMG") return true;
  if (mime?.toLowerCase().startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isPdfAttachment(url: string, mime: string | null, messageType: string | null): boolean {
  if ((messageType ?? "").toUpperCase() === "PDF") return true;
  if (mime?.toLowerCase().includes("pdf")) return true;
  return /\.pdf(\?|$)/i.test(url);
}

type AttachmentViewer =
  | null
  | Readonly<{ kind: "image"; url: string; name: string | null }>
  | Readonly<{ kind: "pdf"; url: string; name: string | null }>
  | Readonly<{ kind: "file"; url: string; name: string | null }>;

function SupportChatPdfListIcon() {
  return (
    <svg
      className="support-chat__att-pdf-svg"
      width={44}
      height={52}
      viewBox="0 0 44 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 4a2 2 0 012-2h16.5L38 15.5V48a2 2 0 01-2 2H8a2 2 0 01-2-2V4z"
        fill="#F5F5F5"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth={1.25}
      />
      <path d="M24 2v12h12" fill="#E0E0E0" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
      <rect x={6} y={34} width={32} height={14} rx={2.5} fill="#E53935" />
      <text
        x={22}
        y={44.5}
        textAnchor="middle"
        fill="#fff"
        fontSize={10}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type SupportTicketChatMessageListProps = Readonly<{
  messages: SupportTicketThreadMessage[];
  listEndRef: RefObject<HTMLDivElement | null>;
}>;

function SupportChatAttachmentViewer({
  viewer,
  onClose,
}: Readonly<{ viewer: Exclude<AttachmentViewer, null>; onClose: () => void }>) {
  const titleId = useId();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = viewer.name?.trim() || (viewer.kind === "image" ? "Image" : "Attachment");

  return (
    <div className="support-chat__viewer-root">
      <button
        type="button"
        className="support-chat__viewer-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        className={`support-chat__viewer-panel support-chat__viewer-panel--${viewer.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="support-chat__viewer-toolbar">
          <h2 id={titleId} className="support-chat__viewer-title">
            {title}
          </h2>
          <div className="support-chat__viewer-actions">
            <button type="button" className="support-chat__viewer-btn support-chat__viewer-btn--close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>
        <div className="support-chat__viewer-body">
          {viewer.kind === "image" ? (
            <img src={viewer.url} alt={viewer.name ?? "Attachment preview"} className="support-chat__viewer-img" />
          ) : null}
          {viewer.kind === "pdf" ? <SupportChatPdfViewer url={viewer.url} /> : null}
          {viewer.kind === "file" ? (
            <p className="support-chat__viewer-file-hint">This file opens best in your browser or another app.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SupportTicketChatMessageList({ messages, listEndRef }: SupportTicketChatMessageListProps) {
  const [viewer, setViewer] = useState<AttachmentViewer>(null);

  return (
    <div className="support-chat__thread-wrap">
      <div className="support-chat__thread" role="log" aria-live="polite">
        {messages.map((msg, index) => {
          const topLabel = msg.outgoing ? msg.senderName : (msg.senderName ?? "Support");
          return (
            <div
              key={msg.id}
              className={`support-chat__row support-chat__row--${msg.outgoing ? "out" : "in"}`}
              style={{ "--msg-i": index } as CSSProperties}
            >
              <div className="support-chat__bubble-wrap">
                <div className={`support-chat__bubble support-chat__bubble--${msg.outgoing ? "out" : "in"}`}>
                  {topLabel ? <span className="support-chat__sender">{topLabel}</span> : null}
                  {msg.text?.trim() ? <p className="support-chat__bubble-text">{msg.text}</p> : null}
                  {msg.attachments.length > 0 ? (
                    <ul className="support-chat__attachments">
                      {msg.attachments.map((a, attIndex) => {
                        const key = `${msg.id}-${attIndex}-${a.url}`;
                        if (isImageAttachment(a.url, a.mimeType, msg.messageType)) {
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                className="support-chat__att-img-btn"
                                onClick={() => setViewer({ kind: "image", url: a.url, name: a.name })}
                                aria-label={`View image: ${a.name ?? "attachment"}`}
                              >
                                <img
                                  src={a.url}
                                  alt=""
                                  className="support-chat__att-img"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </button>
                            </li>
                          );
                        }
                        if (isPdfAttachment(a.url, a.mimeType, msg.messageType)) {
                          const pdfLabel = a.name?.trim() || "Document.pdf";
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                className="support-chat__att-pdf-btn"
                                onClick={() => setViewer({ kind: "pdf", url: a.url, name: a.name })}
                                aria-label={`View PDF: ${pdfLabel}`}
                              >
                                <span className="support-chat__att-pdf-icon-wrap">
                                  <SupportChatPdfListIcon />
                                </span>
                                <span className="support-chat__att-pdf-name">{pdfLabel}</span>
                              </button>
                            </li>
                          );
                        }
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              className="support-chat__att-file"
                              onClick={() => setViewer({ kind: "file", url: a.url, name: a.name })}
                            >
                              {a.name ?? "Open attachment"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
                <time className="support-chat__time" dateTime={msg.createdAt ?? undefined}>
                  {formatWhen(msg.createdAt)}
                </time>
              </div>
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>
      {viewer ? <SupportChatAttachmentViewer viewer={viewer} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}
