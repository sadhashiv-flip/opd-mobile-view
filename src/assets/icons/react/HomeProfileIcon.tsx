import type { ComponentPropsWithoutRef } from "react";
import profileSvg from "../Dashboard/Profile.svg";

export type HomeProfileIconProps = Readonly<
  Omit<ComponentPropsWithoutRef<"img">, "src" | "alt">
>;

export function HomeProfileIcon({
  width = 22,
  height = 22,
  ...rest
}: HomeProfileIconProps) {
  return (
    <img
      src={profileSvg}
      width={width}
      height={height}
      alt=""
      draggable={false}
      {...rest}
    />
  );
}
