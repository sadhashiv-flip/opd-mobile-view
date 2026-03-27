import type { SVGProps } from "react";

export function NavIconOrders(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M8 7h12l-1.2 7H7.2L6 3H3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.5" fill="currentColor" />
      <circle cx="17" cy="20" r="1.5" fill="currentColor" />
      <g className="home-nav__orders-clock">
        <circle cx="17.5" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M17.5 5.4v2l1.3 0.9"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
