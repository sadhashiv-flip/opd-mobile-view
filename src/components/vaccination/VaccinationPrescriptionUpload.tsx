import { uploadPrescriptionFile, type PrescriptionUploadResult } from "@/api/patientUpload";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { useToast } from "@/hooks/useToast";
import { useCallback, useId, useRef, useState } from "react";
import "./VaccinationPrescriptionUpload.css";

export type VaccinationPrescriptionUploadProps = Readonly<{
  attachmentId: string;
  onAttachmentIdChange: (id: string) => void;
  highlight: boolean;
}>;

function previewRole(
  upload: PrescriptionUploadResult | null,
  fileName: string,
): Readonly<{ kind: "image" | "pdf" | "file"; src: string }> | null {
  const path = upload?.meta.path?.trim();
  if (!path) return null;
  const absolute = resolveProfileImageUrl(path);
  if (!absolute) return null;
  const apiType = upload.meta.type?.trim().toUpperCase() ?? "";
  const lower = fileName.toLowerCase();
  if (apiType === "IMG" || apiType === "IMAGE" || apiType.startsWith("IMAGE/")) {
    return { kind: "image", src: absolute };
  }
  if (apiType === "PDF" || apiType === "APPLICATION/PDF" || lower.endsWith(".pdf")) {
    return { kind: "pdf", src: absolute };
  }
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(lower)) {
    return { kind: "image", src: absolute };
  }
  return { kind: "file", src: absolute };
}

export function VaccinationPrescriptionUpload({
  attachmentId,
  onAttachmentIdChange,
  highlight,
}: VaccinationPrescriptionUploadProps) {
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<PrescriptionUploadResult | null>(null);
  const [localFileName, setLocalFileName] = useState("");

  const hasAttachment = attachmentId.trim().length > 0;
  const showHighlight = highlight && !hasAttachment;

  const onPick = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploading(true);
      try {
        const result = await uploadPrescriptionFile(file);
        setUploadResult(result);
        setLocalFileName(file.name);
        onAttachmentIdChange(result.prescriptionId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
        setUploadResult(null);
        setLocalFileName("");
        onAttachmentIdChange("");
      } finally {
        setUploading(false);
      }
    },
    [onAttachmentIdChange, toast],
  );

  const onRemove = useCallback(() => {
    setUploadResult(null);
    setLocalFileName("");
    onAttachmentIdChange("");
    if (inputRef.current) inputRef.current.value = "";
  }, [onAttachmentIdChange]);

  const displayName =
    uploadResult?.meta.file_name?.trim() || localFileName.trim() || "Prescription";
  const role = previewRole(uploadResult, displayName);

  return (
    <div className="vac-rx-upload">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="vac-rx-upload__input"
        accept="image/*,.pdf,application/pdf"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />

      {uploading ? (
        <div
          className={`vac-rx-upload__box${showHighlight ? " vac-rx-upload__box--highlight" : ""}`}
          aria-busy="true"
        >
          <span className="vac-rx-upload__spinner" aria-hidden />
        </div>
      ) : hasAttachment ? (
        <div
          className={`vac-rx-upload__box vac-rx-upload__box--filled${showHighlight ? " vac-rx-upload__box--highlight" : ""}`}
        >
          <div className="vac-rx-upload__preview">
            {role?.kind === "image" ? (
              <img src={role.src} alt="" className="vac-rx-upload__img" />
            ) : role?.kind === "pdf" ? (
              <span className="vac-rx-upload__pdf">PDF</span>
            ) : (
              <span className="vac-rx-upload__file">{displayName}</span>
            )}
          </div>
          <button
            type="button"
            className="vac-rx-upload__remove"
            aria-label="Remove prescription"
            onClick={onRemove}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`vac-rx-upload__box vac-rx-upload__box--empty${showHighlight ? " vac-rx-upload__box--highlight" : ""}`}
          onClick={() => inputRef.current?.click()}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 16V8m0 0l-3 3m3-3 3 3M4 20h16"
              stroke="#FF541E"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={`vac-rx-upload__cta${showHighlight ? " vac-rx-upload__cta--highlight" : ""}`}
          >
            {showHighlight ? "Upload prescription to continue" : "Tap to upload prescription"}
          </span>
          <span className="vac-rx-upload__hint">Required for children age 5 or below</span>
        </button>
      )}
    </div>
  );
}
