import type { WalletTransactionRow } from "@/api/wallet";

export type WalletTransactionItemProps = Readonly<{
  row: WalletTransactionRow;
  onSelect?: (row: WalletTransactionRow) => void;
}>;

function DebitArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V5M12 5l-5 5M12 5l5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefundArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.7071 1.29289C14.0976 1.68342 14.0976 2.31658 13.7071 2.70711L12.4053 4.00896C17.1877 4.22089 21 8.16524 21 13C21 17.9706 16.9706 22 12 22C7.02944 22 3 17.9706 3 13C3 12.4477 3.44772 12 4 12C4.55228 12 5 12.4477 5 13C5 16.866 8.13401 20 12 20C15.866 20 19 16.866 19 13C19 9.2774 16.0942 6.23349 12.427 6.01281L13.7071 7.29289C14.0976 7.68342 14.0976 8.31658 13.7071 8.70711C13.3166 9.09763 12.6834 9.09763 12.2929 8.70711L9.29289 5.70711C9.10536 5.51957 9 5.26522 9 5C9 4.73478 9.10536 4.48043 9.29289 4.29289L12.2929 1.29289C12.6834 0.902369 13.3166 0.902369 13.7071 1.29289Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WalletTransactionItem({ row, onSelect }: WalletTransactionItemProps) {
  const iconWrapClass =
    row.iconVariant === "refund"
      ? "wallet-tx-item__icon-wrap wallet-tx-item__icon-wrap--refund"
      : "wallet-tx-item__icon-wrap wallet-tx-item__icon-wrap--debit";
  const amountClass =
    row.statusTone === "refunded" || row.amountIsCredit
      ? "wallet-tx-item__amount wallet-tx-item__amount--credit"
      : "wallet-tx-item__amount";
  const badgeClass =
    row.statusTone === "refunded"
      ? "wallet-tx-item__badge wallet-tx-item__badge--refunded"
      : "wallet-tx-item__badge wallet-tx-item__badge--success";

  const subtitle = row.patientName?.trim() ? `Booked for ${row.patientName.trim()}` : row.dateLabel;

  const body = (
    <>
      <div className={iconWrapClass} aria-hidden>
        {row.iconVariant === "refund" ? <RefundArrowIcon /> : <DebitArrowIcon />}
      </div>
      <div className="wallet-tx-item__mid">
        <h3 className="wallet-tx-item__title">{row.title}</h3>
        <p className="wallet-tx-item__date">{subtitle}</p>
        {row.patientName?.trim() ? (
          <p className="wallet-tx-item__date wallet-tx-item__date--muted">{row.dateLabel}</p>
        ) : null}
      </div>
      <div className="wallet-tx-item__right">
        <span className={amountClass}>{row.amountFormatted}</span>
        <span className={badgeClass}>{row.statusLabel}</span>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" className="wallet-tx-item wallet-tx-item--button" onClick={() => onSelect(row)}>
        {body}
      </button>
    );
  }

  return <article className="wallet-tx-item">{body}</article>;
}
