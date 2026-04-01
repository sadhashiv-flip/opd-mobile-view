import { useEffect } from "react";
import "./GymRemoveMemberConfirmModal.css";

type GymRemoveMemberConfirmModalProps = Readonly<{
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function GymRemoveMemberConfirmModal({
  open,
  onCancel,
  onConfirm,
}: GymRemoveMemberConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onCancel();
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="grm-root"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="grm-title"
      aria-describedby="grm-desc"
    >
      <button type="button" className="grm-backdrop" aria-label="Cancel" onClick={onCancel} />
      <div className="grm-panel">
        <div className="grm-header">
          <span className="grm-info" aria-hidden="true">
            i
          </span>
          <h2 id="grm-title" className="grm-title">
            Confirm Removal
          </h2>
        </div>
        <div className="grm-body">
          <p id="grm-desc" className="grm-message">
            Are you sure you want to remove the user?
          </p>
        </div>
        <div className="grm-actions">
          <button type="button" className="grm-btn grm-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="grm-btn grm-btn--remove" onClick={onConfirm}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
