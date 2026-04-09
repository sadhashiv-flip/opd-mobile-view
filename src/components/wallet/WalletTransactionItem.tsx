import type { WalletTransactionRow } from "@/api/wallet";

export type WalletTransactionItemProps = Readonly<{
  row: WalletTransactionRow;
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
        d="M4 14a8 8 0 0113.657-5.657L20 9M20 9v-5M20 9h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WalletTransactionItem({ row }: WalletTransactionItemProps) {
  const iconWrapClass =
    row.iconVariant === "refund"
      ? "wallet-tx-item__icon-wrap wallet-tx-item__icon-wrap--refund"
      : "wallet-tx-item__icon-wrap wallet-tx-item__icon-wrap--debit";
  const amountClass = row.amountIsCredit
    ? "wallet-tx-item__amount wallet-tx-item__amount--credit"
    : "wallet-tx-item__amount";
  const badgeClass =
    row.statusTone === "refunded"
      ? "wallet-tx-item__badge wallet-tx-item__badge--refunded"
      : "wallet-tx-item__badge wallet-tx-item__badge--success";

  return (
    <article className="wallet-tx-item">
      <div className={iconWrapClass} aria-hidden>
        {row.iconVariant === "refund" ? <RefundArrowIcon /> : <DebitArrowIcon />}
      </div>
      <div className="wallet-tx-item__mid">
        <h3 className="wallet-tx-item__title">{row.title}</h3>
        <p className="wallet-tx-item__date">{row.dateLabel}</p>
      </div>
      <div className="wallet-tx-item__right">
        <span className={amountClass}>{row.amountFormatted}</span>
        <span className={badgeClass}>{row.statusLabel}</span>
      </div>
    </article>
  );
}
