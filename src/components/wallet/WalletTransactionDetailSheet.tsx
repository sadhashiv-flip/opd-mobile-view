import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { WalletTransactionRow } from "@/api/wallet";
import {
  formatWalletRefIdDisplay,
} from "@/lib/walletTransactionDisplay";
import "./WalletTransactionDetailSheet.css";

export type WalletTransactionDetailSheetProps = Readonly<{
  open: boolean;
  row: WalletTransactionRow | null;
  onClose: () => void;
  onViewOrder: (path: string) => void;
}>;

function DetailRow({ label, value }: Readonly<{ label: string; value: string }>) {
  if (!value.trim()) return null;
  return (
    <div className="wallet-tx-detail-sheet__row">
      <p className="wallet-tx-detail-sheet__label">{label}</p>
      <p className="wallet-tx-detail-sheet__value">{value}</p>
    </div>
  );
}

export function WalletTransactionDetailSheet({
  open,
  row,
  onClose,
  onViewOrder,
}: WalletTransactionDetailSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || row == null) return null;

  const amountClass =
    row.statusTone === "refunded" || row.amountIsCredit
      ? "wallet-tx-detail-sheet__amount wallet-tx-detail-sheet__amount--credit"
      : "wallet-tx-detail-sheet__amount";
  const badgeClass =
    row.statusTone === "refunded"
      ? "wallet-tx-detail-sheet__badge wallet-tx-detail-sheet__badge--refunded"
      : "wallet-tx-detail-sheet__badge wallet-tx-detail-sheet__badge--success";

  const refDisplay = formatWalletRefIdDisplay(row.refId);
  const invoiceDisplay = row.invoiceId?.trim() ? `#${row.invoiceId.replace(/^#/, "")}` : null;

  const dialog = (
    <dialog
      className="wallet-tx-detail-dialog"
      open
      aria-modal="true"
      aria-labelledby="wallet-tx-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="wallet-tx-detail-sheet">
        <header className="wallet-tx-detail-sheet__header">
          <h2 id="wallet-tx-detail-title" className="wallet-tx-detail-sheet__title">
            {row.title}
          </h2>
          <button type="button" className="wallet-tx-detail-sheet__close" aria-label="Close" onClick={onClose}>
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

        <div className="wallet-tx-detail-sheet__scroll">
          <p className={amountClass}>{row.amountFormatted}</p>
          <span className={badgeClass}>{row.statusLabel}</span>

          <DetailRow label="Date" value={row.dateLabel} />
          {row.patientName ? <DetailRow label="Booked for" value={row.patientName} /> : null}
          {refDisplay ? <DetailRow label="Order ref" value={refDisplay} /> : null}
          {invoiceDisplay ? <DetailRow label="Invoice ID" value={invoiceDisplay} /> : null}
          <DetailRow label="Transaction ID" value={row.id} />
          {row.paymentSource ? <DetailRow label="Payment source" value={row.paymentSource} /> : null}
          {row.paymentMode ? <DetailRow label="Payment mode" value={row.paymentMode} /> : null}
          {row.note ? <DetailRow label="Note" value={row.note} /> : null}

          {row.orderDetailPath ? (
            <button
              type="button"
              className="wallet-tx-detail-sheet__cta"
              onClick={() => {
                const path = row.orderDetailPath;
                if (path) {
                  onViewOrder(path);
                  onClose();
                }
              }}
            >
              View order details
            </button>
          ) : null}
        </div>
      </section>
    </dialog>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
