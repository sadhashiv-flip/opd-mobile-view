import { SupportChatPdfViewer } from "@/components/support/SupportChatPdfViewer";
import "@/pages/SupportTicketChatPage.css";
import { useEffect, useId } from "react";

export type AttachmentFilePreviewGalleryItem = Readonly<{ url: string; name: string | null }>;

/** Same shape as support ticket thread attachment preview; optional `gallery` enables prev/next. */
export type AttachmentFilePreviewViewer =
  | null
  | Readonly<{
      kind: "image" | "pdf" | "file";
      url: string;
      name: string | null;
      gallery?: Readonly<{
        items: readonly AttachmentFilePreviewGalleryItem[];
        index: number;
      }>;
    }>;

export function attachmentPreviewKindFromUrl(url: string): "image" | "pdf" | "file" {
  const u = url.trim();
  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(u)) return "image";
  if (/\.pdf(\?|#|$)/i.test(u)) return "pdf";
  return "file";
}

export function AttachmentFilePreview({
  viewer,
  onClose,
  onGalleryNavigate,
}: Readonly<{
  viewer: AttachmentFilePreviewViewer;
  onClose: () => void;
  /** When `viewer.gallery` is set, prev/next call this with -1 / +1. */
  onGalleryNavigate?: (delta: -1 | 1) => void;
}>) {
  const titleId = useId();
  const g = viewer?.gallery;
  const galleryCount = g && g.items.length > 1 ? g.items.length : 0;
  const canPrev = Boolean(g && onGalleryNavigate && g.index > 0);
  const canNext = Boolean(g && onGalleryNavigate && g.index < g.items.length - 1);

  useEffect(() => {
    if (!viewer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (onGalleryNavigate && viewer.gallery && viewer.gallery.items.length > 1) {
        if (e.key === "ArrowLeft" && viewer.gallery.index > 0) {
          e.preventDefault();
          onGalleryNavigate(-1);
        }
        if (e.key === "ArrowRight" && viewer.gallery.index < viewer.gallery.items.length - 1) {
          e.preventDefault();
          onGalleryNavigate(1);
        }
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [viewer, onClose, onGalleryNavigate]);

  if (!viewer) return null;

  const title = viewer.name?.trim() || (viewer.kind === "image" ? "Image" : "Attachment");
  const positionLabel = g && g.items.length > 1 ? `${g.index + 1} / ${g.items.length}` : null;

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
          {galleryCount > 0 && onGalleryNavigate ? (
            <button
              type="button"
              className="support-chat__viewer-btn support-chat__viewer-btn--nav"
              aria-label="Previous file"
              disabled={!canPrev}
              onClick={() => onGalleryNavigate(-1)}
            >
              ‹
            </button>
          ) : null}
          <div className="support-chat__viewer-title-wrap">
            <h2 id={titleId} className="support-chat__viewer-title">
              {title}
            </h2>
            {positionLabel ? (
              <span className="support-chat__viewer-position" aria-live="polite">
                {positionLabel}
              </span>
            ) : null}
          </div>
          {galleryCount > 0 && onGalleryNavigate ? (
            <button
              type="button"
              className="support-chat__viewer-btn support-chat__viewer-btn--nav"
              aria-label="Next file"
              disabled={!canNext}
              onClick={() => onGalleryNavigate(1)}
            >
              ›
            </button>
          ) : null}
          <div className="support-chat__viewer-actions">
            {viewer.kind === "file" ? (
              <a
                href={viewer.url}
                className="support-chat__viewer-btn support-chat__viewer-btn--ghost"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open
              </a>
            ) : null}
            <button
              type="button"
              className="support-chat__viewer-btn support-chat__viewer-btn--close"
              onClick={onClose}
              aria-label="Close"
            >
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
