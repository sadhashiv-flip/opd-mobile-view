import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { uploadPrescriptionFile, type PrescriptionUploadResult } from "@/api/patientUpload";
import { writeVisionGlassesPrescriptions } from "@/constants/visionBookingStorage";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import "./HealthCheckupsPage.css";
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

function formatUploadedAt(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function displayTitle(item: UploadedRxItem): string {
  const m = item.uploadResult?.meta?.file_name?.trim();
  if (m) return m;
  return item.fileName;
}

export function VisionAddPrescriptionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";

  const [items, setItems] = useState<UploadedRxItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
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
            prev.map((it) =>
              it.clientId === clientId
                ? { ...it, uploadResult, uploadedAt: new Date() }
                : it,
            ),
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

  const removeItem = useCallback((clientId: string) => {
    setItems((prev) => {
      const victim = prev.find((it) => it.clientId === clientId);
      if (victim) revokePreview(victim);
      return prev.filter((it) => it.clientId !== clientId);
    });
  }, []);

  const allUploaded =
    items.length > 0 && items.every((it) => it.uploadResult?.prescriptionId);

  const onContinue = useCallback(() => {
    if (!allUploaded) return;
    const stored = items.map((it) => ({
      attachmentId: it.uploadResult!.prescriptionId,
      title: displayTitle(it),
      uploadedAt: (it.uploadedAt ?? new Date()).toISOString(),
    }));
    writeVisionGlassesPrescriptions(stored);
    void navigate(generatePath(ROUTES.visionOverview, { visionType }), { replace: true });
  }, [allUploaded, items, navigate, visionType]);

  if (visionType !== VISION_ROUTE_TYPE.glassesLens) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="hc-page vap-page">
      <header className="vap-top">
        <Link
          to={generatePath(ROUTES.visionSlots, { visionType })}
          className="vap-back"
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
        <h1 className="vap-title">Upload Prescription</h1>
        <span className="vap-top__spacer" aria-hidden />
      </header>

      <main className="hc-main vap-main">
        <section className="vap-hero" aria-labelledby="vap-hero-title">
          <div className="vap-hero__icon" aria-hidden>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12h6m-6 4h3m5-11V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2v-4"
                stroke="#E85D04"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 8l3-3m0 0v4m0-4h-4"
                stroke="#E85D04"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 id="vap-hero-title" className="vap-hero__title">
            Upload Prescription
          </h2>
          <p className="vap-hero__sub">Your prescription is safe with us</p>
        </section>

        <input
          ref={galleryRef}
          type="file"
          className="vap-file-input"
          accept="image/*"
          aria-label="Choose from gallery"
          onChange={onFileInputChange}
        />
        <input
          ref={cameraRef}
          type="file"
          className="vap-file-input"
          accept="image/*"
          capture="environment"
          aria-label="Take a photo"
          onChange={onFileInputChange}
        />
        <input
          ref={filesRef}
          type="file"
          className="vap-file-input"
          accept="image/*,.pdf,application/pdf"
          aria-label="Choose a file"
          onChange={onFileInputChange}
        />

        <button
          type="button"
          className="vap-trigger"
          onClick={() => setSheetOpen(true)}
        >
          <span className="vap-trigger__icon" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 18a4 4 0 01-4-4c0-3.3 3-4 4-4 .5 0 1.2.2 1.8.7.6-.5 1.3-.7 1.8-.7 3 0 4 2.2 4 4a4 4 0 01-4 4H7z"
                stroke="#E85D04"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M12 11v6m-3-3h6"
                stroke="#E85D04"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="vap-trigger__label">Tap to upload prescription</span>
        </button>

        <h2 className="vap-section-title">Uploaded Prescriptions</h2>

        {items.length === 0 ? (
          <div className="vap-empty" role="status">
            <div className="vap-empty__icon" aria-hidden>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect
                  x="4"
                  y="5"
                  width="16"
                  height="14"
                  rx="2"
                  stroke="#C4C4C4"
                  strokeWidth="1.5"
                />
                <circle cx="9" cy="10" r="1.5" fill="#C4C4C4" />
                <path d="M8 14h8M8 17h5" stroke="#C4C4C4" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="vap-empty__text">No prescriptions uploaded yet</p>
          </div>
        ) : (
          <ul className="vap-list">
            {items.map((it) => {
              const ready = Boolean(it.uploadResult?.prescriptionId);
              const title = displayTitle(it);
              const when = it.uploadedAt ? formatUploadedAt(it.uploadedAt) : "—";
              return (
                <li key={it.clientId} className="vap-row">
                  <div className="vap-row__thumb">
                    {it.isImage ? (
                      <img src={it.previewUrl} alt="" className="vap-row__img" />
                    ) : (
                      <span className="vap-row__pdf">PDF</span>
                    )}
                    {ready ? null : (
                      <div className="vap-row__loading" role="status" aria-live="polite">
                        <span className="vap-row__spinner" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="vap-row__meta">
                    <div className="vap-row__name" title={title}>
                      {title.length > 42 ? `${title.slice(0, 40)}…` : title}
                    </div>
                    <div className="vap-row__time">{when}</div>
                  </div>
                  <button
                    type="button"
                    className="vap-row__trash"
                    aria-label={`Remove ${title}`}
                    onClick={() => removeItem(it.clientId)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 7h16M10 11v6M14 11v6M6 7V5a1 1 0 011-1h10a1 1 0 011 1v2M9 7V4h6v3"
                        stroke="#E85D04"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="hc-footer">
        <button type="button" className="bottom-continue" disabled={!allUploaded} onClick={onContinue}>
          Continue
        </button>
      </footer>

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
