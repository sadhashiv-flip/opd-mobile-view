import type { CSSProperties, ReactNode } from "react";

export type WalletModuleProgressRingProps = Readonly<{
  /** 0–100: available_limit ÷ limit for this module. */
  percent: number;
  children: ReactNode;
}>;

const R = 36;
const CX = 50;
const CY = 50;

export function WalletModuleProgressRing({ percent, children }: WalletModuleProgressRingProps) {
  const len = 2 * Math.PI * R;
  const p = Math.min(100, Math.max(0, percent));
  const dashOffset = len * (1 - p / 100);

  const cssVars = {
    "--wallet-mod-ring-len": len,
    "--wallet-mod-ring-offset": dashOffset,
  } as CSSProperties;

  return (
    <div className="wallet-mod-ring-wrap" style={cssVars}>
      <svg className="wallet-mod-ring" viewBox="0 0 100 100" aria-hidden>
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          <circle className="wallet-mod-ring__track" cx={CX} cy={CY} r={R} fill="none" />
          <circle
            className="wallet-mod-ring__progress wallet-mod-ring__progress--animate"
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
          />
        </g>
      </svg>
      <div className="wallet-mod-ring__center">{children}</div>
    </div>
  );
}
