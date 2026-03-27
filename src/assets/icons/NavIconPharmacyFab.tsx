import type { SVGProps } from "react";

/** White first-aid kit on the orange FAB — fixed stroke color. */
export function NavIconPharmacyFab(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" {...props}>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2.5"
        stroke="#ffffff"
        strokeWidth="1.85"
      />
      <path
        d="M12 9v6M9 12h6"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}
