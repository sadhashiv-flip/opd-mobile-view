import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { uploadPrescriptionFile, type PrescriptionUploadResult } from "@/api/patientUpload";
import { readPharmacyFlowState } from "@/constants/pharmacyFlowStorage";
import { writePharmacyReviewDraft } from "@/constants/pharmacyReviewDraft";
import { ROUTES } from "@/constants";
import {
  buildPharmacyPassState,
  readPharmacyBackPath,
  readPharmacyHubReturn,
} from "@/lib/pharmacyFlowNav";
import { useToast } from "@/hooks/useToast";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import "./PharmacyPages.css";

const PHARMACY_PRESCRIPTION_FILE_INPUT_ID = "pharmacy-prescription-file-input";


/** One picked file + `/upload` result — aligned with Flutter `UploadedFile` / `_buildFileCard`. */
type UploadedPrescriptionItem = Readonly<{
  clientId: string;
  fileName: string;
  sourceFile: File;
  /** Local preview (`URL.createObjectURL`); revoked on remove / unmount. */
  previewUrl: string;
  isImage: boolean;
  /** Populated when `POST /upload` succeeds; drives payload. */
  uploadResult: PrescriptionUploadResult | null;
  /** True after a failed upload; user can retry (Dart `retryUpload`). */
  uploadFailed?: boolean;
}>;

function revokeItemPreview(item: UploadedPrescriptionItem) {
  try {
    URL.revokeObjectURL(item.previewUrl);
  } catch {
    // ignore
  }
}

export function PharmacyUploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const hubReturn = readPharmacyHubReturn(location);
  const backPath = readPharmacyBackPath(location, ROUTES.pharmacy);
  const passState = buildPharmacyPassState(hubReturn, backPath);

  const flow = readPharmacyFlowState();
  const [files, setFiles] = useState<UploadedPrescriptionItem[]>([]);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    void ensureDefaultSelectedAddressIfNeeded();
  }, []);

  useEffect(() => {
    return () => {
      for (const f of filesRef.current) {
        revokeItemPreview(f);
      }
    };
  }, []);

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

  const runUploadForItem = useCallback((clientId: string, file: File) => {
    void uploadPrescriptionFile(file)
      .then((uploadResult) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId ? { ...f, uploadResult, uploadFailed: false } : f,
          ),
        );
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
        setFiles((prev) =>
          prev.map((f) => (f.clientId === clientId ? { ...f, uploadFailed: true, uploadResult: null } : f)),
        );
      });
  }, [toast]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const chosen = input.files?.length ? Array.from(input.files) : [];
      input.value = "";
      if (chosen.length === 0) return;

      for (const file of chosen) {
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        const isImage = file.type.startsWith("image/");
        setFiles((prev) => [
          ...prev,
          {
            clientId,
            fileName: file.name,
            sourceFile: file,
            previewUrl,
            isImage,
            uploadResult: null,
            uploadFailed: false,
          },
        ]);

        runUploadForItem(clientId, file);
      }
    },
    [runUploadForItem],
  );

  const retryUpload = useCallback(
    (clientId: string) => {
      const entry = files.find((f) => f.clientId === clientId);
      if (!entry?.uploadFailed) return;
      setFiles((prev) =>
        prev.map((f) => (f.clientId === clientId ? { ...f, uploadFailed: false, uploadResult: null } : f)),
      );
      runUploadForItem(clientId, entry.sourceFile);
    },
    [files, runUploadForItem],
  );

  const confirmRemoveFile = useCallback(() => {
    if (!removeTargetId) return;
    setFiles((prev) => {
      const victim = prev.find((f) => f.clientId === removeTargetId);
      if (victim) revokeItemPreview(victim);
      return prev.filter((f) => f.clientId !== removeTargetId);
    });
    setRemoveTargetId(null);
  }, [removeTargetId]);

  const removeTarget = removeTargetId ? files.find((f) => f.clientId === removeTargetId) : undefined;

  const continueToReview = useCallback(() => {
    if (!flow) {
      toast.error("Session expired. Open pharmacy again.");
      void navigate(ROUTES.pharmacy, { state: passState, replace: true });
      return;
    }
    const ready = files.filter((f) => f.uploadResult?.prescriptionId);
    if (files.length === 0) {
      toast.error("Add at least one prescription file.");
      return;
    }
    if (ready.length !== files.length) {
      toast.error("Wait for uploads to finish.");
      return;
    }
    writePharmacyReviewDraft({
      kind: "UPLOAD",
      files: ready.map((f) => ({
        fileName: f.fileName,
        isImage: f.isImage,
        isPdf: /\.pdf$/i.test(f.fileName),
        prescriptionId: f.uploadResult!.prescriptionId.trim(),
      })),
    });
    void navigate(ROUTES.pharmacyReview, {
      state: { ...passState, backPath: ROUTES.pharmacyUpload, orderKind: "UPLOAD" as const },
    });
  }, [files, flow, navigate, passState, toast]);

  if (!flow) {
    return (
      <div className="ph-page">
        <header className="ph-top-wrap">
          <div className="ph-top">
            <FlowScreenBack
              fallbackTo={backPath}
              fallbackNavigate={{ state: passState }}
              className="ph-back"
            />
            <h1 className="ph-title">Upload Prescription</h1>
            <span className="ph-top__spacer" aria-hidden />
          </div>
        </header>
        <div className="ph-page__main">
          <div className="ph-error">
            <div className="ph-error-illu" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogError} alt="" />
            </div>
            Open pharmacy from the home or services menu to continue.
          </div>
        </div>
      </div>
    );
  }

  const canReview =
    files.length > 0 && files.every((f) => Boolean(f.uploadResult?.prescriptionId) && !f.uploadFailed);

  return (
    <div className="ph-page ph-page--dart-upload">
      <header className="ph-top-wrap">
        <div className="ph-top">
          <FlowScreenBack
            fallbackTo={backPath}
            fallbackNavigate={{ state: passState }}
            className="ph-back"
          />
          <h1 className="ph-title">Upload Prescription</h1>
          <span className="ph-top__spacer" aria-hidden />
        </div>
      </header>

      <main className="ph-page__main ph-page__main--dart-upload">
        <div className="ph-dart-upload-member">
          <span className="ph-dart-upload-member__ic" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                stroke="#ff541e"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="ph-dart-upload-member__text">
            <span className="ph-dart-upload-member__label">Ordering for</span>
            <span className="ph-dart-upload-member__name">{flow.patientName}</span>
          </div>
        </div>

        <input
          id={PHARMACY_PRESCRIPTION_FILE_INPUT_ID}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="ph-prescription-file-input"
          multiple
          aria-label="Choose prescription image or PDF"
          onChange={onInputChange}
        />

        <section className="ph-dart-upload-hero" aria-labelledby="ph-dart-upload-safe">
          <div className="ph-dart-upload-hero__illu" aria-hidden>
            <img src={PHARMACY_IMAGES.uploadPrescription} alt="" />
          </div>
          <p id="ph-dart-upload-safe" className="ph-dart-upload-hero__safe">
            Your prescription is safe with us
          </p>
        </section>

        <label className="ph-dart-upload-add" htmlFor={PHARMACY_PRESCRIPTION_FILE_INPUT_ID}>
          <span className="ph-dart-upload-add__ic" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          Add Prescription
        </label>

        <h2 className="ph-dart-upload-files-title">Selected Files</h2>
        {files.length === 0 ? (
          <div className="ph-dart-upload-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden className="ph-dart-upload-empty__ic">
              <path
                d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10.5L12 14l7-7"
                stroke="#e0e0e0"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>No files selected</p>
          </div>
        ) : (
          <div className="ph-files-grid ph-files-grid--dart">
            {files.map((f) => {
              const ready = Boolean(f.uploadResult?.prescriptionId);
              const loading = !ready && !f.uploadFailed;
              return (
                <div
                  key={f.clientId}
                  className={`ph-file-thumb${ready ? " ph-file-thumb--ok" : ""}${f.uploadFailed ? " ph-file-thumb--fail" : ""}${loading ? " ph-file-thumb--busy" : ""}`}
                >
                  <div className="ph-file-thumb__inner">
                    {f.isImage ? (
                      <img className="ph-file-thumb__img" src={f.previewUrl} alt="" />
                    ) : (
                      <span className="ph-file-thumb__pdf">PDF</span>
                    )}
                    {loading ? (
                      <div className="ph-file-thumb__loading" role="status" aria-live="polite">
                        <span className="ph-file-thumb__spinner" aria-hidden />
                        <span className="ph-sr-only">Uploading…</span>
                      </div>
                    ) : null}
                    {f.uploadFailed ? (
                      <button
                        type="button"
                        className="ph-file-thumb__retry"
                        aria-label={`Retry upload ${f.fileName}`}
                        onClick={() => retryUpload(f.clientId)}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M4 12a8 8 0 018-8V2m0 6l3-3m1 13a8 8 0 01-8 8v2m0-6l-3 3"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>Retry</span>
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="ph-file-thumb__rm"
                    aria-label={`Remove ${f.fileName}`}
                    onClick={() => setRemoveTargetId(f.clientId)}
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

      {canReview ? (
        <div className="ph-footer-btn">
          <button type="button" className="ph-footer-btn__inner ph-footer-btn__inner--review" onClick={() => continueToReview()}>
            Review order
          </button>
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
            aria-labelledby="ph-rm-upload-title"
            aria-describedby="ph-rm-upload-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ph-modal__art" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogWarning} alt="" />
            </div>
            <h2 id="ph-rm-upload-title" className="ph-modal__title">
              Remove prescription?
            </h2>
            <p id="ph-rm-upload-desc" className="ph-modal__text">
              {removeTarget
                ? `This will remove “${removeTarget.fileName}” from your order. You can upload again anytime.`
                : "This file will be removed from your order."}
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
    </div>
  );
}
