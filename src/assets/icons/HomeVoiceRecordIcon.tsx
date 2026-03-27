import type { ComponentPropsWithoutRef } from "react";
import voiceRecordSvg from "./Dashboard/VoiceRecord.svg";

export type HomeVoiceRecordIconProps = Readonly<
  Omit<ComponentPropsWithoutRef<"img">, "src" | "alt">
>;

/** Voice / mic control — uses `VoiceRecord.svg`. */
export function HomeVoiceRecordIcon({
  width = 22,
  height = 22,
  ...rest
}: HomeVoiceRecordIconProps) {
  return (
    <img
      src={voiceRecordSvg}
      width={width}
      height={height}
      alt=""
      draggable={false}
      {...rest}
    />
  );
}
