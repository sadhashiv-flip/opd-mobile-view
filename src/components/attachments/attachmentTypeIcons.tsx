export type AttachmentIconKind = "image" | "pdf" | "doc" | "sheet" | "archive" | "file";

/** Infer display kind from URL query/path and/or human-readable file name. */
export function attachmentIconKindFromUrlAndName(url: string | null, name: string): AttachmentIconKind {
  const raw = `${url ?? ""} ${name}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)(\?|#|$)/i.test(raw)) return "image";
  if (/\.pdf(\?|#|$)/i.test(raw)) return "pdf";
  if (/\.(doc|docx|rtf)(\?|#|$)/i.test(raw)) return "doc";
  if (/\.(xls|xlsx|csv)(\?|#|$)/i.test(raw)) return "sheet";
  if (/\.(zip|rar|7z)(\?|#|$)/i.test(raw)) return "archive";
  return "file";
}

export function AttachmentKindIcon({ kind }: Readonly<{ kind: AttachmentIconKind }>) {
  if (kind === "image") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path
          d="M21 15l-5-5-4 4-3-3-6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "pdf") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M14 3v5h5M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "doc") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M14 3v5h5M9 12h6M9 15h4M9 18h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "sheet") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "archive") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 3h8l2 3v15a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M10 3v4h4V3M10 11h4M10 15h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
