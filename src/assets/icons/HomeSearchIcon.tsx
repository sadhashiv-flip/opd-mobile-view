import type { SVGProps } from "react";

const MUTED = "#9e9e9e";

export function HomeSearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="11" cy="11" r="6.5" stroke={MUTED} strokeWidth="2" />
      <path
        d="M16.5 16.5L21 21"
        stroke={MUTED}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
