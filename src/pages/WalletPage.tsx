import {
  fetchWallet,
  fetchWalletTransactionsPage,
  type WalletDisplay,
  type WalletModuleDisplay,
  type WalletTransactionRow,
} from "@/api/wallet";
import { fetchPatientProfileRaw } from "@/api/patientProfile";
import {
  computeHiddenWalletCategoryKeys,
  filterWalletModulesForSubscription,
} from "@/lib/walletSubscriptionModules";
import { WalletBalanceCard } from "@/components/wallet/WalletBalanceCard";
import { WalletModuleBreakupGrid } from "@/components/wallet/WalletModuleBreakupGrid";
import { WalletScreenHeader } from "@/components/wallet/WalletScreenHeader";
import { WalletTransactionItem } from "@/components/wallet/WalletTransactionItem";
import { ROUTES } from "@/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import "./WalletPages.css";

const RECENT_LIMIT = 5;

export function WalletPage() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<WalletDisplay | null>(null);
  const [profileBody, setProfileBody] = useState<unknown>(null);
  const [recent, setRecent] = useState<readonly WalletTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const subId = subscriptionId?.trim() ?? "";

  const hiddenModuleKeys = useMemo(
    () => computeHiddenWalletCategoryKeys(profileBody, subId),
    [profileBody, subId],
  );

  const visibleModules = useMemo((): readonly WalletModuleDisplay[] => {
    if (!wallet) return [];
    return filterWalletModulesForSubscription(wallet.modules, hiddenModuleKeys);
  }, [wallet, hiddenModuleKeys]);

  const handleBack = useCallback(() => {
    navigate(ROUTES.dashboard);
  }, [navigate]);

  const load = useCallback(async () => {
    if (!subId) return;
    setLoading(true);
    setError(null);
    try {
      const [w, tx, prof] = await Promise.all([
        fetchWallet(),
        fetchWalletTransactionsPage(subId, { page: 1, limit: RECENT_LIMIT }),
        fetchPatientProfileRaw().catch(() => null),
      ]);
      setWallet(w);
      setProfileBody(prof);
      setRecent(tx.items);
    } catch (e) {
      setWallet(null);
      setProfileBody(null);
      setRecent([]);
      setError(e instanceof Error ? e.message : "Could not load wallet");
    } finally {
      setLoading(false);
    }
  }, [subId]);

  useEffect(() => {
    if (!subId) {
      navigate(ROUTES.wallet, { replace: true });
      return;
    }
    void load();
  }, [subId, load, navigate]);

  const goAllTx = useCallback(() => {
    navigate(generatePath(ROUTES.walletTransactions, { subscriptionId: subId }));
  }, [navigate, subId]);

  return (
    <div className="wallet-page">
      <WalletScreenHeader title="OPD Wallet" onBack={handleBack} />

      <main className="wallet-page__main">
        {loading ? (
          <div className="wallet-skeleton" aria-busy="true">
            <div className="wallet-skeleton__balance" />
            <div className="wallet-skeleton__row" />
            <div className="wallet-skeleton__row" />
            <div className="wallet-skeleton__row" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="wallet-state wallet-state--error">
            <p>{error}</p>
            <button type="button" className="wallet-retry" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && wallet ? (
          <>
            <WalletBalanceCard
              availableBalance={wallet.availableBalance}
              totalBalance={wallet.totalBalance}
              validTillLabel={wallet.validTillLabel}
              daysLeft={wallet.daysLeft}
            />
            <WalletModuleBreakupGrid modules={visibleModules} />

            <section className="wallet-recent" aria-labelledby="wallet-recent-heading">
              <div className="wallet-recent__head">
                <h2 id="wallet-recent-heading" className="wallet-recent__title">
                  Recent Transactions
                </h2>
                <button type="button" className="wallet-recent__view-all" onClick={goAllTx}>
                  View All &gt;
                </button>
              </div>

              {recent.length === 0 ? (
                <p className="wallet-state">No transactions yet.</p>
              ) : (
                <ul className="wallet-tx-list">
                  {recent.map((row) => (
                    <li key={row.id}>
                      <WalletTransactionItem row={row} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
