import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/** Must match `pdfjs.version` from `react-pdf` — keep root `pdfjs-dist` in package.json aligned with react-pdf's dependency. */
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Canvas backing-store scale: floor at ~1.5× so 1× / fractional-DPR screens stay sharp; cap for memory. */
function pdfCanvasDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  const r = window.devicePixelRatio || 1;
  return Math.min(2.75, Math.max(r, 1.5));
}

export type SupportChatPdfViewerProps = Readonly<{
  url: string;
}>;

export function SupportChatPdfViewer({ url }: SupportChatPdfViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(300);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canvasDpr = useMemo(() => pdfCanvasDevicePixelRatio(), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const cssW = el.getBoundingClientRect().width;
      if (!(cssW > 0)) return;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      // Snap width to whole device pixels so pdf.js canvas CSS size matches backing store ratio cleanly.
      const snapped = Math.round((cssW * dpr) / dpr);
      setPageWidth(Math.min(Math.max(snapped, 1), 720));
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
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  devicePixelRatio={canvasDpr}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            ))
          : null}
      </Document>
    </div>
  );
}
