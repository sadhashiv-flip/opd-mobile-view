import { useEffect, useId, useRef, useState } from "react";
import { DeleteAccountIllustration } from "./DeleteAccountIllustration";
import "./ProfileAccountModals.css";

type DeleteAccountModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onConfirmDelete?: (feedback: string) => void | Promise<void>;
}>;

const DELETE_COPY =
  "Your account and data will be deleted within 3 months after your deletion request. If you re-login to Flip Health in that time, your account will be re-activated and the previous deletion request will be canceled";

export function DeleteAccountModal({
  open,
  onClose,
  onConfirmDelete,
}: DeleteAccountModalProps) {
  const titleId = useId();
  const feedbackId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFeedback("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const feedbackTrimmed = feedback.trim();
  const canDelete = feedbackTrimmed.length > 0 && !submitting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    try {
      await onConfirmDelete?.(feedbackTrimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="profile-modal-dialog"
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-desc`}
      onClose={() => onClose()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="profile-modal-panel del-modal">
        <h2 id={titleId} className="visually-hidden">
          Delete account
        </h2>
        <DeleteAccountIllustration />
        <p className="del-modal__text" id={`${titleId}-desc`}>
          {DELETE_COPY}
        </p>
        <label className="del-modal__feedback-label" htmlFor={feedbackId}>
          Share your feedback before you go
        </label>
        <textarea
          id={feedbackId}
          className="del-modal__feedback"
          placeholder="Tell us why you're deleting your account - it helps us improve."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          maxLength={2000}
          aria-required="true"
        />
        <footer className="del-modal__footer">
          <button
            type="button"
            className="del-modal__btn del-modal__btn--close"
            onClick={onClose}
            disabled={submitting}
          >
            Close
          </button>
          <button
            type="button"
            className="del-modal__btn del-modal__btn--delete"
            disabled={!canDelete}
            onClick={() => void handleDelete()}
          >
            {submitting ? "…" : "Delete Account"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
