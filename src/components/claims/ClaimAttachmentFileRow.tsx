import type { ReimbursementUploadFileRecord } from "@/api/patientReimbursement";
import {
  reimbursementFileDisplayName,
  reimbursementFileIsPdf,
  resolveReimbursementFilePreviewUrl,
} from "@/lib/reimbursementFileDisplay";

type Props = Readonly<{
  file: ReimbursementUploadFileRecord;
  /** Service types line (patient_app attachment subtitle). */
  serviceLabel?: string;
  onEdit?: () => void;
  onRemove: () => void;
}>;

export function ClaimAttachmentFileRow({ file, serviceLabel, onEdit, onRemove }: Props) {
  const previewUrl = resolveReimbursementFilePreviewUrl(file);
  const isPdf = reimbursementFileIsPdf(file);
  const displayName = reimbursementFileDisplayName(file);
  const showImage = Boolean(previewUrl) && !isPdf;

  return (
    <div className="claim-step2-attach">
      <div className="claim-step2-attach__thumb" aria-hidden>
        {showImage ? (
          <img className="claim-step2-attach__img" src={previewUrl!} alt="" />
        ) : isPdf ? (
          <span className="claim-step2-attach__placeholder claim-step2-attach__placeholder--pdf" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <span className="claim-step2-attach__placeholder">File</span>
        )}
      </div>
      <div className="claim-step2-attach__body">
        <p className="claim-step2-attach__name">{displayName}</p>
        {serviceLabel ? (
          <p
            className={
              serviceLabel === "Service types required"
                ? "claim-step2-attach__st claim-step2-attach__st--warn"
                : "claim-step2-attach__st"
            }
          >
            {serviceLabel}
          </p>
        ) : null}
      </div>
      {onEdit ? (
        <button type="button" className="claim-step2-attach__edit" aria-label="Edit service types" onClick={onEdit}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      <button type="button" className="claim-step2-attach__remove" aria-label="Remove file" onClick={onRemove}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** Compact thumbnail for bill sheet upload row. */
export function ClaimBillFileThumb({
  file,
  onRemove,
}: Readonly<{
  file: ReimbursementUploadFileRecord;
  onRemove: () => void;
}>) {
  const previewUrl = resolveReimbursementFilePreviewUrl(file);
  const isPdf = reimbursementFileIsPdf(file);
  const showImage = Boolean(previewUrl) && !isPdf;

  return (
    <div className="claim-thumb" title={reimbursementFileDisplayName(file)}>
      {showImage ? (
        <img className="claim-thumb__img" src={previewUrl!} alt="" />
      ) : (
        <span className="claim-thumb__label">{isPdf ? "PDF" : "File"}</span>
      )}
      <button type="button" className="claim-thumb__remove" aria-label="Remove" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
