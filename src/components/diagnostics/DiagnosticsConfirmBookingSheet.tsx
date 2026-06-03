import type { ReactNode } from "react";
import { MdClose } from "react-icons/md";
import "./DiagnosticsConfirmBookingSheet.css";

export type DiagnosticsConfirmBookingSheetProps = Readonly<{
  open: boolean;
  titleId: string;
  submitting: boolean;
  useWallet: boolean;
  showWalletToggle: boolean;
  confirmLabel: string;
  onClose: () => void;
  onWalletChange: (value: boolean) => void;
  onConfirm: () => void;
  children: ReactNode;
}>;

/** Matches Flutter diagnostics `Get.bottomSheet` confirm payment (`lab_test_overview` / `health_checkup_overview`). */
export function DiagnosticsConfirmBookingSheet({
  open,
  titleId,
  submitting,
  useWallet,
  showWalletToggle,
  confirmLabel,
  onClose,
  onWalletChange,
  onConfirm,
  children,
}: DiagnosticsConfirmBookingSheetProps) {
  if (!open) return null;

  return (
    <div
      className="diag-pay-sheet-backdrop"
      role="presentation"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="diag-pay-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="diag-pay-sheet__head">
          <h2 id={titleId} className="diag-pay-sheet__title">
            Confirm booking
          </h2>
          <button
            type="button"
            className="diag-pay-sheet__close"
            aria-label="Close"
            disabled={submitting}
            onClick={onClose}
          >
            <MdClose size={22} aria-hidden />
          </button>
        </div>

        <div className="diag-pay-sheet__body">{children}</div>

        {showWalletToggle ? (
          <label className="diag-pay-sheet__wallet">
            <span className="diag-pay-sheet__wallet-label">Use Flip wallet (OPD)</span>
            <input
              type="checkbox"
              className="diag-pay-sheet__switch"
              role="switch"
              checked={useWallet}
              onChange={(e) => onWalletChange(e.target.checked)}
            />
          </label>
        ) : null}

        <button
          type="button"
          className="diag-pay-sheet__cta"
          disabled={submitting}
          onClick={onConfirm}
        >
          {submitting ? "Confirming…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
