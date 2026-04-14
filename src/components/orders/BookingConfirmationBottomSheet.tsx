import type { OfflineBookingPaymentSheetModel } from "@/api/patientOfflineAppointmentPayment";
import "./BookingConfirmationBottomSheet.css";

export type BookingConfirmationBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  model: OfflineBookingPaymentSheetModel | null;
  previewLoading: boolean;
  busy: boolean;
  onProceed: () => void;
}>;

export function BookingConfirmationBottomSheet({
  open,
  onClose,
  model,
  previewLoading,
  busy,
  onProceed,
}: BookingConfirmationBottomSheetProps) {
  if (!open) return null;

  const ctaLabel =
    model != null && model.totalPayable > 0
      ? `Proceed to pay ${model.totalPayableFormatted}`
      : "Proceed to confirm";

  return (
    <dialog
      className="od-bc-dialog"
      open
      aria-modal="true"
      aria-labelledby="od-bc-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="od-bc-panel">
        <header className="od-bc-panel__header">
          <h2 id="od-bc-title" className="od-bc-panel__title">
            Booking confirmation
          </h2>
          <button type="button" className="od-bc-panel__close" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="od-bc-scroll">
          {previewLoading || model == null ? (
            <div className="od-bc-skeleton" aria-busy="true">
              <div className="od-bc-skeleton-line" />
              <div className="od-bc-skeleton-line od-bc-skeleton-line--short" />
              <div className="od-bc-skeleton-line" />
            </div>
          ) : (
            <>
              <div className="od-bc-row">
                <span className="od-bc-row__k">Total amount</span>
                <span className="od-bc-row__v">{model.totalAmountFormatted}</span>
              </div>

              {model.showWalletSection ? (
                <div className="od-bc-wallet">
                  <h3 className="od-bc-wallet__title">{model.walletHeading}</h3>
                  <div className="od-bc-wallet__row">
                    <span className="od-bc-wallet__k">Using from OPD wallet</span>
                    <span className="od-bc-wallet__v">{model.walletDebitLineFormatted}</span>
                  </div>
                  {model.limitAvailableFormatted ? (
                    <p className="od-bc-wallet__limit">
                      Limit available : {model.limitAvailableFormatted}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="od-bc-payable">
                <span className="od-bc-payable__k">Total payable</span>
                <span className="od-bc-payable__v">{model.totalPayableFormatted}</span>
              </div>
            </>
          )}
        </div>

        <div className="od-bc-sep" aria-hidden />

        <p className="od-bc-note">
          Note: Amount will be deducted from your Flip Health Wallet when booking for consultation.
        </p>

        <button
          type="button"
          className="od-bc-cta"
          disabled={busy || previewLoading || model == null}
          aria-busy={busy || previewLoading}
          onClick={() => void onProceed()}
        >
          {busy || previewLoading ? "Please wait…" : ctaLabel}
        </button>
      </section>
    </dialog>
  );
}
