import type { ChangeEvent, RefObject } from "react";

export type SupportTicketChatComposerProps = Readonly<{
  fileInputRef: RefObject<HTMLInputElement | null>;
  files: File[];
  draft: string;
  sending: boolean;
  onPickFiles: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}>;

export function SupportTicketChatComposer({
  fileInputRef,
  files,
  draft,
  sending,
  onPickFiles,
  onFileChange,
  onRemoveFile,
  onDraftChange,
  onSend,
}: SupportTicketChatComposerProps) {
  return (
    <footer className="support-chat__composer">
      {files.length > 0 ? (
        <ul className="support-chat__draft-files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="support-chat__draft-file">
              <span className="support-chat__draft-name">{f.name}</span>
              <button
                type="button"
                className="support-chat__draft-remove"
                onClick={() => onRemoveFile(i)}
                aria-label={`Remove ${f.name}`}
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
        <button type="button" className="support-chat__attach" onClick={onPickFiles} aria-label="Attach file" disabled={sending}>
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
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="button"
          className="support-chat__send"
          onClick={onSend}
          disabled={sending}
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
