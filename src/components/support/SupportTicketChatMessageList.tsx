import type { SupportTicketThreadMessage } from "@/api/supportTicket";
import type { CSSProperties, RefObject } from "react";

function isImageUrl(url: string, mime: string | null): boolean {
  if (mime?.toLowerCase().startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
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
                      {msg.attachments.map((a) =>
                        isImageUrl(a.url, a.mimeType) ? (
                          <li key={a.url}>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="support-chat__att-img-link"
                            >
                              <img src={a.url} alt={a.name ?? "attachment"} className="support-chat__att-img" />
                            </a>
                          </li>
                        ) : (
                          <li key={a.url}>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="support-chat__att-file"
                            >
                              {a.name ?? "Download attachment"}
                            </a>
                          </li>
                        ),
                      )}
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
    </div>
  );
}
