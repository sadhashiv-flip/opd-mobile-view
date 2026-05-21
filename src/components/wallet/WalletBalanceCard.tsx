import walletMiniSvg from "@/assets/icons/Dashboard/Wallet.svg";

export type WalletBalanceCardProps = Readonly<{
  availableBalance: number | null;
  totalBalance: number | null;
  partnerLogoUrl?: string | null;
  partnerLogoAlt?: string | null;
}>;

/** Matches patient-app `WalletScreen._formatCurrency`. */
function formatWalletInr(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "0";
  const amount = Math.round(value);
  if (amount >= 100_000) {
    return `${(amount / 100_000).toFixed(1)}L`;
  }
  const str = String(amount);
  const result: string[] = [];
  let count = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    result.push(str[i]!);
    count++;
    if (count === 3 && i > 0) {
      result.push(",");
    } else if (count > 3 && (count - 3) % 2 === 0 && i > 0) {
      result.push(",");
    }
  }
  return result.reverse().join("");
}

export function WalletBalanceCard({
  availableBalance,
  totalBalance,
  partnerLogoUrl,
  partnerLogoAlt,
}: WalletBalanceCardProps) {
  const total = totalBalance ?? 0;
  const avail = availableBalance ?? 0;
  const pct = total > 0 ? Math.min(100, Math.max(0, (avail / total) * 100)) : 0;

  return (
    <section className="wallet-balance-card wallet-balance-card--animated" aria-labelledby="wallet-balance-heading">
      <div className="wallet-balance-card__top">
        <div className="wallet-balance-card__icon-wrap" aria-hidden>
          <img
            src={walletMiniSvg}
            alt=""
            className="wallet-balance-card__icon-img"
            width={22}
            height={22}
            draggable={false}
          />
        </div>
        <div className="wallet-balance-card__avail">
          <span id="wallet-balance-heading" className="wallet-balance-card__avail-label">
            Available Balance
          </span>
          <p className="wallet-balance-card__avail-value">₹ {formatWalletInr(availableBalance)}</p>
        </div>
      </div>

      <div
        className="wallet-balance-card__bar"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Available balance usage"
      >
        <div
          className="wallet-balance-card__bar-fill wallet-balance-card__bar-fill--animate"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="wallet-balance-card__divider" aria-hidden />

      <div className="wallet-balance-card__bottom">
        <div className="wallet-balance-card__stat">
          <span className="wallet-balance-card__meta-label">Total Balance</span>
          <p className="wallet-balance-card__meta-value">₹ {formatWalletInr(totalBalance)}</p>
        </div>
        {partnerLogoUrl ? (
          <img
            src={partnerLogoUrl}
            alt={partnerLogoAlt ?? "Partner company logo"}
            className="wallet-balance-card__partner-logo"
            width={140}
            height={25}
            draggable={false}
          />
        ) : null}
      </div>
    </section>
  );
}
