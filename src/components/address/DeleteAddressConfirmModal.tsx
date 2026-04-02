import { useEffect } from "react";
import "./DeleteAddressConfirmModal.css";

type DeleteAddressConfirmModalProps = Readonly<{
  open: boolean;
  tag: string;
  addressPreview: string | null;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function DeleteAddressConfirmModal({
  open,
  tag,
  addressPreview,
  confirming,
  onCancel,
  onConfirm,
}: DeleteAddressConfirmModalProps) {
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
      if (e.key !== "Escape" || confirming) return;
      e.preventDefault();
      onCancel();
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [open, confirming, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="dac-root"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dac-title"
      aria-describedby="dac-desc"
    >
      <button type="button" className="dac-backdrop" aria-label="Cancel" onClick={onCancel} />
      <div className="dac-panel">
        <div className="dac-header">
          <span className="dac-icon" aria-hidden="true">
            !
          </span>
          <h2 id="dac-title" className="dac-title">
            Delete address?
          </h2>
        </div>
        <div className="dac-body">
          <p id="dac-desc" className="dac-message">
            This will permanently remove <strong>{tag || "this address"}</strong> from your account.
          </p>
          {addressPreview ? <p className="dac-preview">{addressPreview}</p> : null}
        </div>
        <div className="dac-actions">
          <button
            type="button"
            className="dac-btn dac-btn--cancel"
            disabled={confirming}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dac-btn dac-btn--delete"
            disabled={confirming}
            onClick={() => onConfirm()}
          >
            {confirming ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
