import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { uploadPrescriptionFile, type PrescriptionUploadResult } from "@/api/patientUpload";
import { postMedicineOrder } from "@/api/pharmacy";
import { readPharmacyFlowState, resolvePharmacyOrderAddressId } from "@/constants/pharmacyFlowStorage";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import "./PharmacyPages.css";

const PHARMACY_PRESCRIPTION_FILE_INPUT_ID = "pharmacy-prescription-file-input";

type NavState = Readonly<{ returnPath?: string }>;

/** One picked file + `/upload` result used for `POST /medicine` (`prescription_id`). */
type UploadedPrescriptionItem = Readonly<{
  clientId: string;
  fileName: string;
  /** Local preview (`URL.createObjectURL`); revoked on remove / unmount. */
  previewUrl: string;
  isImage: boolean;
  /** Populated when `POST /upload` succeeds; drives payload. */
  uploadResult: PrescriptionUploadResult | null;
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

  const hubReturn = (location.state as NavState | null)?.returnPath ?? ROUTES.dashboard;
  const passState: NavState = { returnPath: hubReturn };

  const flow = readPharmacyFlowState();
  const [files, setFiles] = useState<UploadedPrescriptionItem[]>([]);
  const [busy, setBusy] = useState(false);
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

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      // Copy before clearing: `FileList` is live — resetting `value` empties it in many browsers,
      // so uploads would never run.
      const chosen = input.files?.length ? Array.from(input.files) : [];
      input.value = "";
      if (chosen.length === 0) return;

      for (const file of chosen) {
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        const isImage = file.type.startsWith("image/");
        setFiles((prev) => [
          ...prev,
          { clientId, fileName: file.name, previewUrl, isImage, uploadResult: null },
        ]);

        void uploadPrescriptionFile(file)
          .then((uploadResult) => {
            setFiles((prev) =>
              prev.map((f) => (f.clientId === clientId ? { ...f, uploadResult } : f)),
            );
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : "Upload failed";
            toast.error(msg);
            setFiles((prev) => {
              const victim = prev.find((f) => f.clientId === clientId);
              if (victim) revokeItemPreview(victim);
              return prev.filter((f) => f.clientId !== clientId);
            });
          });
      }
    },
    [toast],
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

  const placeOrder = useCallback(async () => {
    if (!flow) {
      toast.error("Session expired. Open pharmacy again.");
      void navigate(ROUTES.pharmacy, { state: passState, replace: true });
      return;
    }
    await ensureDefaultSelectedAddressIfNeeded();
    const addressId = resolvePharmacyOrderAddressId(flow);
    if (!addressId) {
      toast.error("Choose a delivery address.");
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

    setBusy(true);
    try {
      await postMedicineOrder({
        address_id: addressId,
        prescriptions: ready.map((f) => ({
          type: "OTHER",
          prescription_id: f.uploadResult!.prescriptionId,
        })),
        patient_id: flow.patientId,
      });
      void navigate(ROUTES.pharmacyOrderSuccess, { state: passState });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  }, [files, flow, navigate, passState, toast]);

  if (!flow) {
    return (
      <div className="ph-page">
        <header className="ph-top-wrap">
          <div className="ph-top">
            <Link to={ROUTES.pharmacy} state={passState} className="ph-back" aria-label="Back">
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

  return (
    <div className="ph-page">
      <header className="ph-top-wrap">
        <div className="ph-top">
          <Link to={ROUTES.pharmacy} state={passState} className="ph-back" aria-label="Back">
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
        <div className="ph-member-card ph-member-card--static ph-member-card--upload">
          <span className="ph-member-card__avatar" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="ph-member-card__text">
            <span className="ph-member-card__label">Ordering for</span>
            <span className="ph-member-card__name">{flow.patientName}</span>
          </span>
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

        <label className="ph-upload-zone" htmlFor={PHARMACY_PRESCRIPTION_FILE_INPUT_ID}>
          <div className="ph-upload-zone__illu" aria-hidden>
            <img src={PHARMACY_IMAGES.uploadPrescription} alt="" />
          </div>
          <p className="ph-upload-zone__title">Tap to upload prescription</p>
          <p className="ph-upload-zone__sub">Your prescription is safe with us</p>
        </label>

        <label className="ph-btn-outline" htmlFor={PHARMACY_PRESCRIPTION_FILE_INPUT_ID}>
          <span className="ph-btn-outline__icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>{" "}
          Add Prescription
        </label>

        <h2 className="ph-files-title">Selected Files</h2>
        {files.length === 0 ? (
          <div className="ph-empty-files">No files selected</div>
        ) : (
          <div className="ph-files-grid">
            {files.map((f) => {
              const ready = Boolean(f.uploadResult?.prescriptionId);
              return (
                <div key={f.clientId} className="ph-file-thumb">
                  <div className="ph-file-thumb__inner">
                    {f.isImage ? (
                      <img className="ph-file-thumb__img" src={f.previewUrl} alt="" />
                    ) : (
                      <span className="ph-file-thumb__pdf">PDF</span>
                    )}
                    {ready ? null : (
                      <div className="ph-file-thumb__loading" role="status" aria-live="polite">
                        <span className="ph-file-thumb__spinner" aria-hidden />
                        <span className="ph-sr-only">Uploading…</span>
                      </div>
                    )}
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

      <div className="ph-footer-btn">
        <button type="button" className="ph-footer-btn__inner" disabled={busy} onClick={() => void placeOrder()}>
          {busy ? "Placing…" : "Place Order"}
        </button>
      </div>

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
