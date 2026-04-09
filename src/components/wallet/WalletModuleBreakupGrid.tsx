import type { CSSProperties } from "react";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { WalletModuleProgressRing } from "@/components/wallet/WalletModuleProgressRing";
import type { WalletModuleDisplay } from "@/api/wallet";

export type WalletModuleBreakupGridProps = Readonly<{
  modules: readonly WalletModuleDisplay[];
}>;

function formatInr(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(n);
}

function modulePercent(balance: number | null, limit: number | null): number {
  if (limit == null || limit <= 0 || balance == null) return 0;
  return Math.min(100, Math.max(0, (balance / limit) * 100));
}

function displayLabel(label: string): string {
  return label.trim().toLowerCase();
}

const TINT_CLASS: Record<string, string> = {
  consultation: "wallet-mod--consultation",
  lab: "wallet-mod--lab",
  pharmacy: "wallet-mod--pharmacy",
  dental: "wallet-mod--dental",
  vision: "wallet-mod--vision",
  vaccine: "wallet-mod--vaccine",
  gym: "wallet-mod--fitness",
  mental_wellness: "wallet-mod--mental",
  nutrition: "wallet-mod--nutrition",
};

export function WalletModuleBreakupGrid({ modules }: WalletModuleBreakupGridProps) {
  if (modules.length === 0) return null;

  return (
    <section className="wallet-mod-section" aria-labelledby="wallet-mod-heading">
      <h2 id="wallet-mod-heading" className="wallet-mod-section__title">
        Module Breakup
      </h2>
      <div className="wallet-mod-grid">
        {modules.map((m, idx) => {
          const tint = TINT_CLASS[m.categoryKey] ?? "wallet-mod--default";
          const pct = modulePercent(m.balance, m.limit);
          return (
            <article
              key={`${m.refType}-${idx}`}
              className={`wallet-mod-card ${tint}`}
              style={{ "--wallet-mod-i": idx } as CSSProperties}
            >
              <WalletModuleProgressRing percent={pct}>
                <div className="wallet-mod-ring__icon-inner" aria-hidden>
                  <OrderCategoryIcon categoryKey={m.categoryKey} width={26} height={26} className="wallet-mod-card__icon" />
                </div>
              </WalletModuleProgressRing>
              <h3 className="wallet-mod-card__name">{displayLabel(m.label)}</h3>
              <p className="wallet-mod-card__current">₹{formatInr(m.balance)}</p>
              <p className="wallet-mod-card__limit">
                of ₹{formatInr(m.limit)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
