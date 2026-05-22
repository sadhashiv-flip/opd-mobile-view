import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import {
  VISION_PRESCRIPTION_EMPTY_COPY,
  VISION_PRESCRIPTION_PAGE_TITLE,
  VISION_PRESCRIPTION_SAFE_COPY,
  VISION_PRESCRIPTION_TAP_UPLOAD,
  VISION_PRESCRIPTION_UPLOADED_TITLE,
} from "@/constants/visionPrescriptionCopy";
import { uploadPrescriptionFile, type PrescriptionUploadResult } from "@/api/patientUpload";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import {
  readVisionGlassesPrescriptions,
  writeVisionGlassesPrescriptions,
  type VisionGlassesPrescriptionStored,
} from "@/constants/visionBookingStorage";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/primary-buttons.css";
import "./VisionAddPrescriptionPage.css";

const VISION_GLASSES_PRESCRIPTION_FILE_INPUT_ID = "vision-glasses-prescription-file-input";

type UploadedRxItem = Readonly<{
  clientId: string;
  fileName: string;
  previewUrl: string;
  isImage: boolean;
  uploadResult: PrescriptionUploadResult;
  uploadedAt: Date;
}>;

function revokePreviewUrl(url: string) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

function revokePreview(item: UploadedRxItem) {
  revokePreviewUrl(item.previewUrl);
}

function displayTitle(item: UploadedRxItem): string {
  const m = item.uploadResult.meta?.file_name?.trim();
  if (m) return m;
  return item.fileName;
}

function hydrateUploadedItem(s: VisionGlassesPrescriptionStored): UploadedRxItem {
  const title = s.title.trim() || s.attachmentId;
  const lower = title.toLowerCase();
  const isImage =
    s.type?.trim().toUpperCase() === "IMG" ||
    s.type?.trim().toUpperCase() === "IMAGE" ||
    /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(lower);

  const uploadResult: PrescriptionUploadResult = {
    prescriptionId: s.attachmentId,
    meta: {
      file_name: title,
      ...(s.path?.trim() ? { path: s.path.trim() } : {}),
      ...(s.type?.trim() ? { type: s.type.trim() } : {}),
    },
    raw: { hydrated: true } as unknown,
  };

  let uploadedAt = new Date();
  if (s.uploadedAt?.trim()) {
    const d = new Date(s.uploadedAt);
    if (!Number.isNaN(d.getTime())) uploadedAt = d;
  }

  return {
    clientId: s.attachmentId,
    fileName: title,
    previewUrl: "",
    isImage,
    uploadResult,
    uploadedAt,
  };
}

function itemsToStoredPayload(items: readonly UploadedRxItem[]): VisionGlassesPrescriptionStored[] {
  return items.map((it) => {
    const meta = it.uploadResult;
    const path = meta.meta.path?.trim();
    const type = meta.meta.type?.trim();
    return {
      attachmentId: meta.prescriptionId,
      title: displayTitle(it),
      uploadedAt: it.uploadedAt.toISOString(),
      ...(path ? { path } : {}),
      ...(type ? { type } : {}),
    };
  });
}

function previewRole(
  item: UploadedRxItem,
): Readonly<{ kind: "image" | "pdf" | "file"; src: string }> {
  const path = item.uploadResult.meta.path?.trim();
  const apiType = item.uploadResult.meta.type?.trim().toUpperCase() ?? "";
  const nameSrc = displayTitle(item);

  if (path) {
    const absolute = resolveProfileImageUrl(path);
    if (absolute) {
      if (apiType === "IMG" || apiType === "IMAGE" || apiType.startsWith("IMAGE/")) {
        return { kind: "image", src: absolute };
      }
      if (apiType === "PDF" || apiType === "APPLICATION/PDF") {
        return { kind: "pdf", src: absolute };
      }
      const lower = nameSrc.toLowerCase();
      if (/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(lower)) {
        return { kind: "image", src: absolute };
      }
      if (lower.endsWith(".pdf")) return { kind: "pdf", src: absolute };
      return { kind: "file", src: absolute };
    }
  }

  return {
    kind: item.isImage ? "image" : "pdf",
    src: item.previewUrl,
  };
}

function GridThumbPreview(props: Readonly<{ pv: ReturnType<typeof previewRole> }>) {
  if (props.pv.kind === "image") {
    return <img src={props.pv.src} alt="" />;
  }
  if (props.pv.kind === "pdf") {
    return <iframe title="" src={props.pv.src} />;
  }
  return <span className="vap-grid__thumb-file">FILE</span>;
}

function PrescriptionFullPreview(props: Readonly<{ pv: ReturnType<typeof previewRole>; title: string }>) {
  if (props.pv.kind === "image") {
    return <img src={props.pv.src} alt={props.title} className="vap-preview__img" />;
  }
  if (props.pv.kind === "pdf") {
    return <iframe title={props.title} src={props.pv.src} className="vap-preview__iframe" />;
  }
  return (
    <div className="vap-preview__file-fallback">
      <p className="vap-preview__file-msg">Preview isn’t available for this file type.</p>
      <a href={props.pv.src} target="_blank" rel="noopener noreferrer" className="vap-preview__open-link">
        Open in browser
      </a>
    </div>
  );
}

export function VisionAddPrescriptionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<UploadedRxItem[]>(() => {
    const vt = params.visionType?.trim() ?? "";
    if (vt !== VISION_ROUTE_TYPE.glassesLens) return [];
    return readVisionGlassesPrescriptions().map(hydrateUploadedItem);
  });
  const [uploading, setUploading] = useState(false);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        if (it.previewUrl) revokePreview(it);
      }
    };
  }, []);

  useEffect(() => {
    if (visionType !== VISION_ROUTE_TYPE.glassesLens) return;
    writeVisionGlassesPrescriptions(itemsToStoredPayload(items));
  }, [items, visionType]);

  useEffect(() => {
    if (!previewClientId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewClientId(null);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [previewClientId]);

  const runUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      const previewUrl = URL.createObjectURL(file);
      const isImage = file.type.startsWith("image/");
      try {
        const uploadResult = await uploadPrescriptionFile(file);
        const rel = uploadResult.meta.path?.trim();
        const useBlob = !rel || !resolveProfileImageUrl(rel);
        setItems((prev) => [
          ...prev,
          {
            clientId: uploadResult.prescriptionId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            fileName: file.name,
            previewUrl: useBlob ? previewUrl : "",
            isImage,
            uploadResult,
            uploadedAt: new Date(),
          },
        ]);
        if (!useBlob) revokePreviewUrl(previewUrl);
      } catch (err) {
        revokePreviewUrl(previewUrl);
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [toast],
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const chosen = input.files?.length ? Array.from(input.files) : [];
      input.value = "";
      if (chosen.length === 0 || uploading) return;
      void (async () => {
        for (const file of chosen) {
          await runUpload(file);
        }
      })();
    },
    [runUpload, uploading],
  );

  const removeItem = useCallback((clientId: string) => {
    setPreviewClientId((cur) => (cur === clientId ? null : cur));
    setItems((prev) => {
      const victim = prev.find((it) => it.clientId === clientId);
      if (victim?.previewUrl) revokePreview(victim);
      return prev.filter((it) => it.clientId !== clientId);
    });
  }, []);

  const onContinue = useCallback(() => {
    if (items.length === 0) return;
    void navigate(generatePath(ROUTES.visionOverview, { visionType }), { replace: true });
  }, [items.length, navigate, visionType]);

  if (visionType !== VISION_ROUTE_TYPE.glassesLens) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const previewItem = previewClientId
    ? items.find((x) => x.clientId === previewClientId) ?? null
    : null;
  const previewData = previewItem
    ? { pv: previewRole(previewItem), title: displayTitle(previewItem) }
    : null;

  return (
    <div className="vap-page">
      <header className="vap-page__top">
        <Link
          to={generatePath(ROUTES.visionSlots, { visionType })}
          className="vap-page__back"
          aria-label="Back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="vap-page__title">{VISION_PRESCRIPTION_PAGE_TITLE}</h1>
        <span className="vap-page__top-spacer" aria-hidden />
      </header>

      <main className="vap-page__scroll">
        <div className="vap-info-card">
          <svg
            className="vap-info-card__icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M14 2v6h6M12 18v-6M9 15h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="vap-info-card__title">{VISION_PRESCRIPTION_PAGE_TITLE}</p>
          <p className="vap-info-card__sub">{VISION_PRESCRIPTION_SAFE_COPY}</p>
        </div>

        <input
          ref={fileInputRef}
          id={VISION_GLASSES_PRESCRIPTION_FILE_INPUT_ID}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="vap-prescription-file-input"
          multiple
          aria-hidden
          tabIndex={-1}
          onChange={onFileInputChange}
        />

        {uploading ? (
          <div className="vap-upload-loading" aria-busy="true" aria-live="polite">
            <span className="vap-upload-loading__spin" aria-hidden />
          </div>
        ) : (
          <button
            type="button"
            className="vap-upload-tap"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              className="vap-upload-tap__icon"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M12 16V4m0 0l-4 4m4-4 4 4M4 20h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="vap-upload-tap__label">{VISION_PRESCRIPTION_TAP_UPLOAD}</span>
          </button>
        )}

        <h2 className="vap-section-title">{VISION_PRESCRIPTION_UPLOADED_TITLE}</h2>

        {items.length === 0 ? (
          <div className="vap-empty">
            <svg
              className="vap-empty__icon"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 11h8M8 15h5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path d="M9 3h6v2H9V3z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p className="vap-empty__text">{VISION_PRESCRIPTION_EMPTY_COPY}</p>
          </div>
        ) : (
          <div className="vap-grid">
            {items.map((it) => {
              const title = displayTitle(it);
              const pv = previewRole(it);
              return (
                <div key={it.clientId} className="vap-grid__item">
                  <button
                    type="button"
                    className="vap-grid__open"
                    aria-label={`Preview ${title}`}
                    onClick={() => setPreviewClientId(it.clientId)}
                  >
                    <div className="vap-grid__thumb">
                      <GridThumbPreview pv={pv} />
                    </div>
                  </button>
                  <button
                    type="button"
                    className="vap-grid__remove"
                    aria-label={`Remove ${title}`}
                    onClick={() => removeItem(it.clientId)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {items.length > 0 ? (
        <footer className="vap-page__footer mobile-frame-fixed-footer">
          <button type="button" className="bottom-continue" onClick={onContinue}>
            Continue
          </button>
        </footer>
      ) : null}

      {previewData ? (
        <div
          className="vap-preview-overlay"
          role="presentation"
          onClick={() => setPreviewClientId(null)}
        >
          <div
            className="vap-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vap-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vap-preview-head">
              <h2 id="vap-preview-title" className="vap-preview-title">
                {previewData.title.length > 48 ? `${previewData.title.slice(0, 46)}…` : previewData.title}
              </h2>
              <button
                type="button"
                className="vap-preview-close"
                aria-label="Close preview"
                onClick={() => setPreviewClientId(null)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="vap-preview-body">
              <PrescriptionFullPreview pv={previewData.pv} title={previewData.title} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
