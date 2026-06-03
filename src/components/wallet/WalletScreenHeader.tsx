import { AppBackChevron } from "@/components/navigation/AppBackChevron";
import { backButtonClass } from "@/lib/backButtonClass";
import type { ReactNode } from "react";

export type WalletScreenHeaderProps = Readonly<{
  title: string;
  onBack: () => void;
  right?: ReactNode;
}>;

export function WalletScreenHeader({ title, onBack, right }: WalletScreenHeaderProps) {
  return (
    <header className="wallet-screen-header">
      <button
        type="button"
        className={backButtonClass("wallet-screen-header__back")}
        aria-label="Back"
        onClick={onBack}
      >
        <AppBackChevron />
      </button>
      <h1 className="wallet-screen-header__title">{title}</h1>
      <div className="wallet-screen-header__right">{right ?? <span className="wallet-screen-header__spacer" aria-hidden />}</div>
    </header>
  );
}
