import { fetchActiveSubscriptions } from "@/api/patientSubscriptions";
import { fetchWallet } from "@/api/wallet";
import { ROUTES } from "@/constants";
import { useEffect, useState } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import "./WalletPages.css";

export function WalletRedirectPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const wallet = await fetchWallet();
        let sid = wallet.subscriptionId;
        if (!sid) {
          const subs = await fetchActiveSubscriptions();
          sid = subs.items[0]?.id ?? null;
        }
        if (cancelled) return;
        if (sid) {
          navigate(generatePath(ROUTES.walletSubscription, { subscriptionId: sid }), { replace: true });
          return;
        }
        setError("No active subscription found for your wallet.");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not open wallet.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, retryKey]);

  return (
    <div className="wallet-page">
      <main className="wallet-page__main">
        {!error ? (
          <div className="wallet-skeleton" aria-busy="true">
            <div className="wallet-skeleton__balance" />
            <div className="wallet-skeleton__row" />
            <div className="wallet-skeleton__row" />
          </div>
        ) : (
          <div className="wallet-state wallet-state--error">
            <p>{error}</p>
            <div className="wallet-redirect-actions">
              <button type="button" className="wallet-retry" onClick={() => setRetryKey((k) => k + 1)}>
                Try again
              </button>
              <button
                type="button"
                className="wallet-retry wallet-retry--secondary"
                onClick={() => navigate(ROUTES.dashboard, { replace: true })}
              >
                Back to home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
