import type { SupportTicketDetail, SupportTicketThreadMessage } from "@/api/supportTicket";
import type { RefObject } from "react";
import { SupportTicketChatMessageList } from "@/components/support/SupportTicketChatMessageList";

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

export type SupportTicketChatLoadedBodyProps = Readonly<{
  detail: SupportTicketDetail;
  displayMessages: SupportTicketThreadMessage[];
  listEndRef: RefObject<HTMLDivElement | null>;
}>;

export function SupportTicketChatLoadedBody({ detail, displayMessages, listEndRef }: SupportTicketChatLoadedBodyProps) {
  return (
    <>
      <section className="support-chat__summary" aria-label="Ticket details">
        <div className="support-chat__issue">
          <div className="support-chat__issue-head">
            <span className="support-chat__issue-label">Issue</span>
            {detail.ticket.language ? (
              <span className="support-chat__issue-lang">{detail.ticket.language}</span>
            ) : null}
          </div>
          <p className="support-chat__issue-text">{detail.ticket.message?.trim() || "—"}</p>
          <time className="support-chat__issue-time" dateTime={detail.ticket.createdAt ?? undefined}>
            {formatWhen(detail.ticket.createdAt)}
          </time>
        </div>
      </section>

      <SupportTicketChatMessageList messages={displayMessages} listEndRef={listEndRef} />
    </>
  );
}
