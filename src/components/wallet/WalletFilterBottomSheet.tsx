import { useEffect, useState } from "react";
import type { WalletRefTypeApi, WalletStatusFilter } from "@/api/wallet";
import { WALLET_TYPE_FILTER_OPTIONS } from "@/constants/walletFilterTypes";

export type WalletFilterBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Called when the user taps Apply or Reset filters (parent should refetch). Reset passes `{ status: null, refType: null }`. */
  onApply: (next: { status: WalletStatusFilter | null; refType: WalletRefTypeApi | null }) => void;
  initialStatus: WalletStatusFilter | null;
  initialRefType: WalletRefTypeApi | null;
  /** Ref types hidden by subscription (same rules as wallet module breakup). */
  hiddenRefTypes?: ReadonlySet<WalletRefTypeApi>;
}>;

export function WalletFilterBottomSheet({
  open,
  onClose,
  onApply,
  initialStatus,
  initialRefType,
  hiddenRefTypes,
}: WalletFilterBottomSheetProps) {
  const [status, setStatus] = useState<WalletStatusFilter | null>(initialStatus);
  const [refType, setRefType] = useState<WalletRefTypeApi | null>(initialRefType);

  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus);
    setRefType(initialRefType);
  }, [open, initialStatus, initialRefType]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const hasSelection = status !== null || refType !== null;
  const hasAppliedFilters = initialStatus !== null || initialRefType !== null;
  /** Show all transactions again and/or clear an in-progress selection. */
  const canReset = hasAppliedFilters || hasSelection;

  const handleCancel = () => {
    onClose();
  };

  const handleReset = () => {
    if (!canReset) return;
    onApply({ status: null, refType: null });
    onClose();
  };

  const handleApply = () => {
    if (!hasSelection) return;
    onApply({ status, refType });
    onClose();
  };

  const toggleStatus = (s: WalletStatusFilter) => {
    setStatus((cur) => (cur === s ? null : s));
  };

  const toggleRef = (r: WalletRefTypeApi) => {
    setRefType((cur) => (cur === r ? null : r));
  };

  if (!open) return null;

  return (
    <dialog
      className="wallet-filter-dialog"
      open
      aria-modal="true"
      aria-labelledby="wallet-filter-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleCancel();
      }}
    >
      <section className="wallet-filter-sheet">
        <div className="wallet-filter-sheet__handle" aria-hidden />
        <header className="wallet-filter-sheet__header">
          <h2 id="wallet-filter-title" className="wallet-filter-sheet__title">
            Filter Transactions
          </h2>
          <button type="button" className="wallet-filter-sheet__close" aria-label="Close" onClick={handleCancel}>
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

        <div className="wallet-filter-sheet__body">
          <div className="wallet-filter-block">
            <h3 className="wallet-filter-block__label">Status</h3>
            <div className="wallet-filter-block__row">
              {(["Success", "Refunded"] as const).map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    className={`wallet-filter-pill${active ? " wallet-filter-pill--active" : ""}`}
                    onClick={() => toggleStatus(s)}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="wallet-filter-block">
            <h3 className="wallet-filter-block__label">Type</h3>
            <div className="wallet-filter-type-grid">
              {WALLET_TYPE_FILTER_OPTIONS.map(({ api, label }) => {
                if (hiddenRefTypes?.has(api)) return null;
                const active = refType === api;
                return (
                  <button
                    key={api}
                    type="button"
                    className={`wallet-filter-pill wallet-filter-pill--grid${active ? " wallet-filter-pill--active" : ""}`}
                    onClick={() => toggleRef(api)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="wallet-filter-sheet__reset-wrap">
          <button
            type="button"
            className="wallet-filter-reset"
            disabled={!canReset}
            title={!canReset ? "No filters to reset" : "Show all transactions"}
            onClick={handleReset}
          >
            Reset filters
          </button>
        </div>

        <footer className="wallet-filter-sheet__footer">
          <button type="button" className="wallet-filter-btn wallet-filter-btn--cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="wallet-filter-btn wallet-filter-btn--apply"
            disabled={!hasSelection}
            title={!hasSelection ? "Select at least one filter" : undefined}
            onClick={handleApply}
          >
            Apply
          </button>
        </footer>
      </section>
    </dialog>
  );
}
