import type { SVGProps } from "react";

export function LoginFieldValidIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...props}>
      <circle cx="10" cy="10" r="10" fill="#4CAF50" />
      <path
        d="M5.5 10.2L8.5 13.2L14.5 7.2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
