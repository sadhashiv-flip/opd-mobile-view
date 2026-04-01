import type { ComponentPropsWithoutRef } from "react";
import walletSvg from "../Dashboard/Wallet.svg";

export type HomeWalletIconProps = Readonly<
  Omit<ComponentPropsWithoutRef<"img">, "src" | "alt">
>;

export function HomeWalletIcon({
  width = 22,
  height = 22,
  ...rest
}: HomeWalletIconProps) {
  return (
    <img
      src={walletSvg}
      width={width}
      height={height}
      alt=""
      draggable={false}
      {...rest}
    />
  );
}
