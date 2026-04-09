import walletMiniSvg from "@/assets/icons/Dashboard/Wallet.svg";

const DAYS_LEFT_NOTICE_MAX = 60;

export type WalletBalanceCardProps = Readonly<{
  availableBalance: number | null;
  totalBalance: number | null;
  validTillLabel: string | null;
  daysLeft: number | null;
}>;

function formatInr(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(n);
}

function daysLeftMessage(days: number): string {
  if (days < 0) return "Your plan has expired. Renew to keep using your wallet benefits.";
  if (days === 0) return "Your plan ends today. Renew soon to avoid interruption.";
  if (days === 1) return "Only 1 day left on your plan.";
  return `Only ${days} days left on your plan.`;
}

function CalendarClockIcon() {
  return (
    <svg className="wallet-balance-card__days-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12.2V14l1.2.7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function WalletBalanceCard({ availableBalance, totalBalance, validTillLabel, daysLeft }: WalletBalanceCardProps) {
  const total = totalBalance ?? 0;
  const avail = availableBalance ?? 0;
  const pct = total > 0 ? Math.min(100, Math.max(0, (avail / total) * 100)) : 0;

  const showDaysNotice =
    daysLeft != null && Number.isFinite(daysLeft) && daysLeft < DAYS_LEFT_NOTICE_MAX;
  const daysUrgent = showDaysNotice && daysLeft <= 14;

  return (
    <section className="wallet-balance-card wallet-balance-card--animated" aria-labelledby="wallet-balance-heading">
      <div className="wallet-balance-card__top">
        <div className="wallet-balance-card__icon-wrap" aria-hidden>
          <img src={walletMiniSvg} alt="" className="wallet-balance-card__icon-img" width={22} height={22} draggable={false} />
        </div>
        <div className="wallet-balance-card__avail">
          <span id="wallet-balance-heading" className="wallet-balance-card__avail-label">
            Available Balance
          </span>
          <p className="wallet-balance-card__avail-value">₹ {formatInr(availableBalance)}</p>
        </div>
      </div>
      <div className="wallet-balance-card__bar" aria-hidden="true">
        <div
          className="wallet-balance-card__bar-fill wallet-balance-card__bar-fill--animate"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showDaysNotice ? (
        <div
          className={`wallet-balance-card__days${daysUrgent ? " wallet-balance-card__days--urgent" : ""}`}
          role="status"
        >
          <CalendarClockIcon />
          <p className="wallet-balance-card__days-text">{daysLeftMessage(daysLeft!)}</p>
        </div>
      ) : null}
      <div className="wallet-balance-card__bottom">
        <div>
          <span className="wallet-balance-card__meta-label">Total Balance</span>
          <p className="wallet-balance-card__meta-value">₹ {formatInr(totalBalance)}</p>
        </div>
        <div className="wallet-balance-card__bottom-right">
          <span className="wallet-balance-card__meta-label">Valid Till</span>
          <p className="wallet-balance-card__meta-value">{validTillLabel ?? "—"}</p>
        </div>
      </div>
    </section>
  );
}
