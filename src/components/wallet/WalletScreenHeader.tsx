import type { ReactNode } from "react";

export type WalletScreenHeaderProps = Readonly<{
  title: string;
  onBack: () => void;
  right?: ReactNode;
}>;

export function WalletScreenHeader({ title, onBack, right }: WalletScreenHeaderProps) {
  return (
    <header className="wallet-screen-header">
      <button type="button" className="wallet-screen-header__back" aria-label="Back" onClick={onBack}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <h1 className="wallet-screen-header__title">{title}</h1>
      <div className="wallet-screen-header__right">{right ?? <span className="wallet-screen-header__spacer" aria-hidden />}</div>
    </header>
  );
}
