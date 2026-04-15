import type { SupportTicketThreadMessage } from "@/api/supportTicket";
import { AttachmentFilePreview } from "@/components/attachments/AttachmentFilePreview";
import {
  AttachmentKindIcon,
  attachmentIconKindFromUrlAndName,
} from "@/components/attachments/attachmentTypeIcons";
import { useAttachmentFilePreviewGallery } from "@/hooks/useAttachmentFilePreviewGallery";
import type { CSSProperties, RefObject } from "react";

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

export function SupportTicketChatMessageList({ messages, listEndRef }: SupportTicketChatMessageListProps) {
  const { viewer, openPreview, closePreview, onGalleryNavigate } = useAttachmentFilePreviewGallery();

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
                        const galleryItems = msg.attachments
                          .map((att) => ({ url: att.url?.trim() ?? "", name: att.name ?? null }))
                          .filter((x) => x.url.length > 0);
                        const openInGallery = () => openPreview(galleryItems, a.url.trim());
                        if (isImageAttachment(a.url, a.mimeType, msg.messageType)) {
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                className="support-chat__att-img-btn"
                                onClick={openInGallery}
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
                                onClick={openInGallery}
                                aria-label={`View PDF: ${pdfLabel}`}
                              >
                                <span className="support-chat__att-pdf-icon-wrap" data-attach-kind="pdf">
                                  <AttachmentKindIcon kind="pdf" />
                                </span>
                                <span className="support-chat__att-pdf-action">View</span>
                              </button>
                            </li>
                          );
                        }
                        const fileLabel = a.name?.trim() || "Attachment";
                        const fk = attachmentIconKindFromUrlAndName(a.url, fileLabel);
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              className="support-chat__att-file support-chat__att-file--typed"
                              onClick={openInGallery}
                              aria-label={`Open ${fileLabel}`}
                            >
                              <span className="support-chat__att-file-icon" data-attach-kind={fk}>
                                <AttachmentKindIcon kind={fk} />
                              </span>
                              <span className="support-chat__att-file-action">Open</span>
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
      {viewer ? (
        <AttachmentFilePreview viewer={viewer} onClose={closePreview} onGalleryNavigate={onGalleryNavigate} />
      ) : null}
    </div>
  );
}
