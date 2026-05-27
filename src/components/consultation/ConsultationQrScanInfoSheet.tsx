import { CONSULT_QR_COPY } from "@/constants/consultationQrCopy";
import "@/components/address/AddressBottomSheet.css";
import "./ConsultationQrScanInfoSheet.css";

export type ConsultationQrScanInfoSheetProps = Readonly<{
  open: boolean;
  fulfillmentType: string;
  onClose: () => void;
  onContinue: () => void;
}>;

function copyForType(fulfillmentType: string): {
  title: string;
  message: string;
  tips: readonly string[];
  badge: string | null;
  accent: "practo" | "upi" | "generic";
} {
  const t = fulfillmentType.trim().toUpperCase();
  if (t === "PRACTO") {
    return {
      title: CONSULT_QR_COPY.practoTitle,
      message: CONSULT_QR_COPY.practoMessage,
      tips: [CONSULT_QR_COPY.practoTip1, CONSULT_QR_COPY.practoTip2],
      badge: CONSULT_QR_COPY.badgePracto,
      accent: "practo",
    };
  }
  if (t === "UPI") {
    return {
      title: CONSULT_QR_COPY.upiTitle,
      message: CONSULT_QR_COPY.upiMessage,
      tips: [CONSULT_QR_COPY.upiTip1, CONSULT_QR_COPY.upiTip2],
      badge: CONSULT_QR_COPY.badgeUpi,
      accent: "upi",
    };
  }
  return {
    title: CONSULT_QR_COPY.genericTitle,
    message: CONSULT_QR_COPY.genericMessage(fulfillmentType.trim() || "clinic"),
    tips: [CONSULT_QR_COPY.genericTip1, CONSULT_QR_COPY.genericTip2],
    badge: fulfillmentType.trim() ? fulfillmentType.trim().toUpperCase() : null,
    accent: "generic",
  };
}

export function ConsultationQrScanInfoSheet({
  open,
  fulfillmentType,
  onClose,
  onContinue,
}: ConsultationQrScanInfoSheetProps) {
  if (!open) return null;
  const copy = copyForType(fulfillmentType);

  return (
    <dialog
      className="addr-sheet-dialog consult-qr-info-dialog"
      open
      aria-modal="true"
      aria-labelledby="consult-qr-info-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className={`consult-qr-info consult-qr-info--${copy.accent}`}>
        <div className="consult-qr-info__header">
          {copy.badge ? <span className="consult-qr-info__badge">{copy.badge}</span> : null}
          <button type="button" className="addr-sheet__close" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <h2 id="consult-qr-info-title" className="consult-qr-info__title">
          {copy.title}
        </h2>
        <p className="consult-qr-info__message">{copy.message}</p>
        <ul className="consult-qr-info__tips">
          {copy.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <div className="consult-qr-info__actions">
          <button type="button" className="consult-qr-info__secondary" onClick={onClose}>
            {CONSULT_QR_COPY.cancel}
          </button>
          <button type="button" className="consult-qr-info__primary" onClick={onContinue}>
            {CONSULT_QR_COPY.continue}
          </button>
        </div>
      </div>
    </dialog>
  );
}
