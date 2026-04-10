import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
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
import "./PharmacyPages.css";
import "./VisionAddPrescriptionPage.css";

type UploadedRxItem = Readonly<{
  clientId: string;
  fileName: string;
  previewUrl: string;
  isImage: boolean;
  uploadResult: PrescriptionUploadResult | null;
  uploadedAt: Date | null;
}>;

function revokePreview(item: UploadedRxItem) {
  try {
    URL.revokeObjectURL(item.previewUrl);
  } catch {
    // ignore
  }
}

function displayTitle(item: UploadedRxItem): string {
  const m = item.uploadResult?.meta?.file_name?.trim();
  if (m) return m;
  return item.fileName;
}

/** Rebuild list state after Continue → Overview → Back (session has `path` / `type`). */
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

  let uploadedAt: Date | null = null;
  if (s.uploadedAt?.trim()) {
    const d = new Date(s.uploadedAt);
    uploadedAt = Number.isNaN(d.getTime()) ? new Date() : d;
  } else {
    uploadedAt = new Date();
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
  return items
    .filter((it) => it.uploadResult?.prescriptionId)
    .map((it) => {
      const meta = it.uploadResult!;
      const path = meta.meta.path?.trim();
      const type = meta.meta.type?.trim();
      return {
        attachmentId: meta.prescriptionId,
        title: displayTitle(it),
        uploadedAt: (it.uploadedAt ?? new Date()).toISOString(),
        ...(path ? { path } : {}),
        ...(type ? { type } : {}),
      };
    });
}

/** Upload `data.type` / file extension → how to preview. */
function previewRole(
  item: UploadedRxItem,
): Readonly<{ kind: "image" | "pdf" | "file"; src: string }> {
  const path = item.uploadResult?.meta.path?.trim();
  const apiType = item.uploadResult?.meta.type?.trim().toUpperCase() ?? "";
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

function PrescriptionThumbPreview(props: {
  pv: ReturnType<typeof previewRole>;
  title: string;
}) {
  const { pv, title } = props;
  if (pv.kind === "image") {
    return <img src={pv.src} alt="" className="ph-file-thumb__img" />;
  }
  if (pv.kind === "pdf") {
    return <iframe title={title} src={pv.src} className="ph-file-thumb__pdf-frame" />;
  }
  return <span className="ph-file-thumb__pdf">FILE</span>;
}

function PrescriptionFullPreview(props: {
  pv: ReturnType<typeof previewRole>;
  title: string;
}) {
  const { pv, title } = props;
  if (pv.kind === "image") {
    return <img src={pv.src} alt={title} className="vap-preview__img" />;
  }
  if (pv.kind === "pdf") {
    return <iframe title={title} src={pv.src} className="vap-preview__iframe" />;
  }
  return (
    <div className="vap-preview__file-fallback">
      <p className="vap-preview__file-msg">Preview isn’t available for this file type.</p>
      <a href={pv.src} target="_blank" rel="noopener noreferrer" className="vap-preview__open-link">
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

  const [items, setItems] = useState<UploadedRxItem[]>(() => {
    const vt = params.visionType?.trim() ?? "";
    if (vt !== VISION_ROUTE_TYPE.glassesLens) return [];
    return readVisionGlassesPrescriptions().map(hydrateUploadedItem);
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        revokePreview(it);
      }
    };
  }, []);

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

  useEffect(() => {
    if (!removeTargetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setRemoveTargetId(null);
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [removeTargetId]);

  /** Keep session in sync so Overview and Back navigation still show attachments. */
  useEffect(() => {
    if (visionType !== VISION_ROUTE_TYPE.glassesLens) return;
    writeVisionGlassesPrescriptions(itemsToStoredPayload(items));
  }, [items, visionType]);

  const runUpload = useCallback(
    (file: File) => {
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      const isImage = file.type.startsWith("image/");
      setItems((prev) => [
        ...prev,
        {
          clientId,
          fileName: file.name,
          previewUrl,
          isImage,
          uploadResult: null,
          uploadedAt: null,
        },
      ]);

      uploadPrescriptionFile(file)
        .then((uploadResult) => {
          setItems((prev) =>
            prev.map((it) => {
              if (it.clientId !== clientId) return it;
              const next = { ...it, uploadResult, uploadedAt: new Date() };
              const rel = uploadResult.meta.path?.trim();
              if (rel && resolveProfileImageUrl(rel)) {
                revokePreview(it);
              }
              return next;
            }),
          );
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "Upload failed";
          toast.error(msg);
          setItems((prev) => {
            const victim = prev.find((it) => it.clientId === clientId);
            if (victim) revokePreview(victim);
            return prev.filter((it) => it.clientId !== clientId);
          });
        });
    },
    [toast],
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const chosen = input.files?.length ? Array.from(input.files) : [];
      input.value = "";
      setSheetOpen(false);
      for (const file of chosen) {
        runUpload(file);
      }
    },
    [runUpload],
  );

  const confirmRemoveFile = useCallback(() => {
    if (!removeTargetId) return;
    setPreviewClientId((cur) => (cur === removeTargetId ? null : cur));
    setItems((prev) => {
      const victim = prev.find((it) => it.clientId === removeTargetId);
      if (victim) revokePreview(victim);
      return prev.filter((it) => it.clientId !== removeTargetId);
    });
    setRemoveTargetId(null);
  }, [removeTargetId]);

  const removeTarget = removeTargetId ? items.find((it) => it.clientId === removeTargetId) : undefined;
  const removeTitle = removeTarget ? displayTitle(removeTarget) : "";

  const allUploaded =
    items.length > 0 && items.every((it) => it.uploadResult?.prescriptionId);

  const onContinue = useCallback(() => {
    if (!allUploaded) return;
    void navigate(generatePath(ROUTES.visionOverview, { visionType }), { replace: true });
  }, [allUploaded, navigate, visionType]);

  const openSheet = useCallback(() => setSheetOpen(true), []);

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
    <div className="ph-page">
      <header className="ph-top-wrap">
        <div className="ph-top">
          <Link
            to={generatePath(ROUTES.visionSlots, { visionType })}
            className="ph-back"
            aria-label="Back"
            onClick={() => writeVisionGlassesPrescriptions([])}
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
          <h1 className="ph-title">Upload Prescription</h1>
          <span className="ph-top__spacer" aria-hidden />
        </div>
      </header>

      <main className="ph-page__main">
        <input
          ref={galleryRef}
          type="file"
          className="ph-prescription-file-input"
          accept="image/*"
          aria-label="Choose from gallery"
          onChange={onFileInputChange}
        />
        <input
          ref={cameraRef}
          type="file"
          className="ph-prescription-file-input"
          accept="image/*"
          capture="environment"
          aria-label="Take a photo"
          onChange={onFileInputChange}
        />
        <input
          ref={filesRef}
          type="file"
          className="ph-prescription-file-input"
          accept="image/*,.pdf,application/pdf"
          aria-label="Choose a file"
          onChange={onFileInputChange}
        />

        <div
          role="button"
          tabIndex={0}
          className="ph-upload-zone"
          onClick={openSheet}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openSheet();
            }
          }}
        >
          <div className="ph-upload-zone__illu" aria-hidden>
            <img src={PHARMACY_IMAGES.uploadPrescription} alt="" />
          </div>
          <p className="ph-upload-zone__title">Tap to upload prescription</p>
          <p className="ph-upload-zone__sub">Your prescription is safe with us</p>
        </div>

        <button type="button" className="ph-btn-outline" onClick={openSheet}>
          <span className="ph-btn-outline__icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>{" "}
          Add Prescription
        </button>

        <h2 className="ph-files-title">Selected Files</h2>
        {items.length === 0 ? (
          <div className="ph-empty-files">No files selected</div>
        ) : (
          <div className="ph-files-grid">
            {items.map((it) => {
              const ready = Boolean(it.uploadResult?.prescriptionId);
              const title = displayTitle(it);
              const pv = previewRole(it);
              return (
                <div key={it.clientId} className="ph-file-thumb">
                  <button
                    type="button"
                    className="ph-file-thumb__open"
                    aria-label={`Preview ${title}`}
                    onClick={() => setPreviewClientId(it.clientId)}
                  >
                    <div className="ph-file-thumb__inner">
                      <PrescriptionThumbPreview pv={pv} title={title} />
                      {ready ? null : (
                        <div className="ph-file-thumb__loading" role="status" aria-live="polite">
                          <span className="ph-file-thumb__spinner" aria-hidden />
                          <span className="ph-sr-only">Uploading…</span>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="ph-file-thumb__rm"
                    aria-label={`Remove ${title}`}
                    onClick={() => setRemoveTargetId(it.clientId)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  {ready ? (
                    <span className="ph-file-thumb__ok" aria-hidden title="Uploaded">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 12l5 5L20 7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <div className="ph-footer-btn">
        <button type="button" className="ph-footer-btn__inner" disabled={!allUploaded} onClick={onContinue}>
          Continue
        </button>
      </div>

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

      {removeTargetId ? (
        <div
          className="ph-modal-overlay"
          role="presentation"
          onClick={() => setRemoveTargetId(null)}
        >
          <div
            className="ph-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="vap-rm-upload-title"
            aria-describedby="vap-rm-upload-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ph-modal__art" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogWarning} alt="" />
            </div>
            <h2 id="vap-rm-upload-title" className="ph-modal__title">
              Remove prescription?
            </h2>
            <p id="vap-rm-upload-desc" className="ph-modal__text">
              {removeTitle
                ? `This will remove “${removeTitle}” from your upload. You can add it again anytime.`
                : "This file will be removed."}
            </p>
            <div className="ph-modal__actions">
              <button type="button" className="ph-btn-grey" onClick={() => setRemoveTargetId(null)}>
                Cancel
              </button>
              <button type="button" className="ph-btn-orange" onClick={confirmRemoveFile}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <div
          className="vap-sheet-overlay"
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="vap-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vap-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="vap-sheet-title" className="vap-sheet__title">
              Choose Source
            </h3>
            <ul className="vap-sheet__list">
              <li>
                <button
                  type="button"
                  className="vap-sheet__opt"
                  onClick={() => galleryRef.current?.click()}
                >
                  <span className="vap-sheet__opt-icon vap-sheet__opt-icon--gallery" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                        stroke="#E85D04"
                        strokeWidth="1.75"
                      />
                      <circle cx="8.5" cy="10" r="1.5" fill="#E85D04" />
                      <path
                        d="M21 15l-5-5-4 4-2-2-4 4"
                        stroke="#E85D04"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="vap-sheet__opt-label">Gallery</span>
                  <span className="vap-sheet__chev" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="vap-sheet__opt"
                  onClick={() => cameraRef.current?.click()}
                >
                  <span className="vap-sheet__opt-icon vap-sheet__opt-icon--camera" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 9h2l1.5-2h9L18 9h2a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2z"
                        stroke="#E85D04"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="15" r="3" stroke="#E85D04" strokeWidth="1.75" />
                    </svg>
                  </span>
                  <span className="vap-sheet__opt-label">Camera</span>
                  <span className="vap-sheet__chev" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="vap-sheet__opt"
                  onClick={() => filesRef.current?.click()}
                >
                  <span className="vap-sheet__opt-icon vap-sheet__opt-icon--file" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 3v4a1 1 0 001 1h4"
                        stroke="#E85D04"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                      <path
                        d="M6 21h9a2 2 0 002-2V9l-5-5H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        stroke="#E85D04"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="vap-sheet__opt-label">Files</span>
                  <span className="vap-sheet__chev" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
