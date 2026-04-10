import type { SVGProps } from "react";

export type HomeNotificationIconProps = Readonly<SVGProps<SVGSVGElement>>;

export function HomeNotificationIcon(props: HomeNotificationIconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 3a5 5 0 00-5 5v2.382l-.894 1.789A1 1 0 007 14h10a1 1 0 00.894-1.553L17 10.382V8a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 104 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
