import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/** Must match `pdfjs.version` from `react-pdf` — keep root `pdfjs-dist` in package.json aligned with react-pdf's dependency. */
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type SupportChatPdfViewerProps = Readonly<{
  url: string;
}>;

export function SupportChatPdfViewer({ url }: SupportChatPdfViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(300);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) setPageWidth(Math.min(w, 720));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="support-chat__pdf-pages">
      {error ? (
        <p className="support-chat__pdf-error" role="alert">
          {error}
        </p>
      ) : null}
      <Document
        file={url}
        className="support-chat__pdf-document"
        loading={<div className="support-chat__pdf-loading">Loading PDF…</div>}
        onLoadSuccess={({ numPages: n }) => {
          setNumPages(n);
          setError(null);
        }}
        onLoadError={(e) => {
          setError(e.message || "Could not load PDF");
          setNumPages(0);
        }}
      >
        {numPages > 0
          ? Array.from({ length: numPages }, (_, i) => (
              <div key={i + 1} className="support-chat__pdf-page-wrap">
                <Page pageNumber={i + 1} width={pageWidth} renderTextLayer renderAnnotationLayer />
              </div>
            ))
          : null}
      </Document>
    </div>
  );
}
