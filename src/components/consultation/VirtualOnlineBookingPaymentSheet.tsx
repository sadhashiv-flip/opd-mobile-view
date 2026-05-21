import type { VirtualOnlinePaymentSheetModel } from "@/api/virtualOnlineBookingPayment";
import "@/components/orders/BookingConfirmationBottomSheet.css";
import "./VirtualOnlineBookingPaymentSheet.css";

export type VirtualOnlineBookingPaymentSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  model: VirtualOnlinePaymentSheetModel | null;
  previewLoading: boolean;
  busy: boolean;
  onProceed: () => void;
}>;

export function VirtualOnlineBookingPaymentSheet({
  open,
  onClose,
  model,
  previewLoading,
  busy,
  onProceed,
}: VirtualOnlineBookingPaymentSheetProps) {
  if (!open) return null;

  const ctaLabel =
    model != null && model.totalPayable > 0
      ? `Proceed to pay ${model.totalPayableFormatted}`
      : "Proceed to confirm";

  return (
    <dialog
      className="od-bc-dialog vc-pay-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="vc-pay-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="od-bc-panel vc-pay-sheet">
        <header className="od-bc-panel__header">
          <h2 id="vc-pay-sheet-title" className="od-bc-panel__title">
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

        <div className="od-bc-scroll vc-pay-sheet__scroll">
          {previewLoading || model == null ? (
            <div className="od-bc-skeleton" aria-busy="true">
              <div className="od-bc-skeleton-line" />
              <div className="od-bc-skeleton-line od-bc-skeleton-line--short" />
              <div className="od-bc-skeleton-line" />
            </div>
          ) : (
            <>
              <div className="vc-pay-row">
                <span className="vc-pay-row__k">Consultation fee</span>
                <span className="vc-pay-row__v">{model.consultationFeeFormatted}</span>
              </div>
              {model.walletDebitFormatted ? (
                <div className="vc-pay-row">
                  <span className="vc-pay-row__k">Using from wallet</span>
                  <span className="vc-pay-row__v">{model.walletDebitFormatted}</span>
                </div>
              ) : null}
              <div className="vc-pay-divider" aria-hidden />
              <div className="vc-pay-row vc-pay-row--total">
                <span className="vc-pay-row__k">Total payable</span>
                <span className="vc-pay-row__v">{model.totalPayableFormatted}</span>
              </div>
              <div className="vc-pay-divider" aria-hidden />
              <p className="vc-pay-note">{model.note}</p>
            </>
          )}
        </div>

        <button
          type="button"
          className="od-bc-cta vc-pay-sheet__cta"
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
