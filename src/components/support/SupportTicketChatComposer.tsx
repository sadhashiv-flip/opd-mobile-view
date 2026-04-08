import type { ChangeEvent, RefObject } from "react";

/** In-flight or failed attach+send row (successful sends are removed after POST). */
export type SupportChatDraftAttachment = Readonly<{
  id: string;
  fileName: string;
  /** True while `/upload` or follow-up `POST support/ticket/:id` is in progress. */
  uploading: boolean;
  error: string | null;
}>;

export type SupportTicketChatComposerProps = Readonly<{
  fileInputRef: RefObject<HTMLInputElement | null>;
  attachments: SupportChatDraftAttachment[];
  draft: string;
  sending: boolean;
  /** When true, Send stays disabled (e.g. uploads in progress or nothing to send). */
  sendDisabled?: boolean;
  attachDisabled?: boolean;
  onPickFiles: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (id: string) => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}>;

export function SupportTicketChatComposer({
  fileInputRef,
  attachments,
  draft,
  sending,
  sendDisabled = false,
  attachDisabled = false,
  onPickFiles,
  onFileChange,
  onRemoveAttachment,
  onDraftChange,
  onSend,
}: SupportTicketChatComposerProps) {
  return (
    <footer className="support-chat__composer">
      {attachments.length > 0 ? (
        <ul className="support-chat__draft-files">
          {attachments.map((a) => (
            <li
              key={a.id}
              className={`support-chat__draft-file${a.uploading ? " support-chat__draft-file--uploading" : ""}${a.error ? " support-chat__draft-file--error" : ""}`}
            >
              <span className="support-chat__draft-name" title={a.error ?? a.fileName}>
                {a.uploading ? "Sending… " : null}
                {a.error ? "Failed: " : null}
                {a.fileName}
              </span>
              <button
                type="button"
                className="support-chat__draft-remove"
                onClick={() => onRemoveAttachment(a.id)}
                aria-label={`Remove ${a.fileName}`}
                disabled={a.uploading}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="support-chat__composer-inner">
        <input
          ref={fileInputRef}
          type="file"
          className="support-chat__file-input"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          multiple
          onChange={onFileChange}
        />
        <button
          type="button"
          className="support-chat__attach"
          onClick={onPickFiles}
          aria-label="Attach file"
          disabled={sending || attachDisabled}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l8.49-8.49a4 4 0 015.66 5.66l-8.49 8.49a2.5 2.5 0 01-3.54-3.54l7.78-7.78"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <textarea
          className="support-chat__input"
          rows={1}
          placeholder="Message support…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (sending || sendDisabled) return;
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="button"
          className="support-chat__send"
          onClick={onSend}
          disabled={sending || sendDisabled}
          aria-label="Send message"
        >
          {sending ? (
            <span className="support-chat__send-spinner" aria-hidden />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
}
