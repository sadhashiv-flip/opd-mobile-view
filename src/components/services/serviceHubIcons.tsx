/** Line-art icons for Services hub — stroke #111, 24×24 viewBox unless noted. */
import type { SVGProps } from "react";

const s = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export function IconTabOpd(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M7 3h10v18H7V3zM10 7h4M10 11h4M10 15h3" />
      <path d="M17 18l3 3" />
      <circle cx="18" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTabAccount(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a5 5 0 015-5h2a5 5 0 015 5v1" />
      <circle cx="18" cy="6" r="2" />
      <path d="M18 4v4M16 6h4" />
    </svg>
  );
}

export function IconTabHelp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M4 14v2a3 3 0 003 3h1M20 14v2a3 3 0 01-3 3h-1" />
      <path d="M6 14a8 8 0 0112 0" />
    </svg>
  );
}

export function IconTabRecords(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M8 3h10v18H8a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M10 9h6M10 13h6M10 17h4" />
      <path d="M12 3v4h6" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M17 15.5v3M15.5 17h3" />
    </svg>
  );
}

export function IconDocShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M7 3h10v18H7V3zM10 7h6M10 11h4" />
      <path d="M17 17l2 2M16 18h4" />
    </svg>
  );
}

export function IconBank(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M3 10l9-5 9 5v2H3v-2zM5 12v8h14v-8M9 20v-4h6v4" />
    </svg>
  );
}

export function IconProfile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a5 5 0 015-5h2a5 5 0 015 5v1" />
    </svg>
  );
}

export function IconJarPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <rect x="8" y="5" width="8" height="14" rx="2" />
      <path d="M12 10v4M10 12h4" />
    </svg>
  );
}

export function IconFamily(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <circle cx="8" cy="9" r="2" />
      <circle cx="16" cy="9" r="2" />
      <circle cx="12" cy="7" r="2" />
      <path d="M4 18v-1a3 3 0 013-3h2M20 18v-1a3 3 0 00-3-3h-2" />
    </svg>
  );
}

export function IconAddressBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M10 3v18M14 8h4" />
    </svg>
  );
}

export function IconCart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M6 6h15l-1.5 9H7.5L6 3H3" />
      <circle cx="10" cy="20" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <rect x="6" y="10" width="12" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 118 0v3" />
    </svg>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1-3h10l1 3M9 7v12a1 1 0 001 1h4a1 1 0 001-1V7" />
    </svg>
  );
}

export function IconInvoice(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M7 3h10l2 2v16H7V3zM9 3v18M14 3v2" />
      <path d="M10 12h6M10 16h4" />
    </svg>
  );
}

export function IconHeadset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M4 14v2a3 3 0 003 3h1M20 14v2a3 3 0 01-3 3h-1" />
      <path d="M6 14a8 8 0 0112 0" />
    </svg>
  );
}

export function IconFaq(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M8 10h6a2 2 0 010 4h-1M8 18h6M8 6h4" />
      <circle cx="17" cy="8" r="3" />
      <path d="M17 6.5v1.5M17 10h.01" />
    </svg>
  );
}

export function IconTerms(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M7 3h10v18H7V3zM10 7h6M10 11h6M10 15h4" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M17 16v2" />
    </svg>
  );
}

export function IconPrivacy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M7 3h10v18H7V3zM10 8h6" />
      <path d="M14 16l2 2 3-3" />
    </svg>
  );
}

export function IconCalendarPerson(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
      <circle cx="16" cy="16" r="2.5" />
    </svg>
  );
}

export function IconLabClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M9 3h6v3H9V3zM8 6h8v15H8a1 1 0 01-1-1V7a1 1 0 011-1z" />
      <path d="M12 11v4M10 13h4" />
    </svg>
  );
}

export function IconRx(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M7 3h10v18H7V3zM10 8h6M10 12h4" />
      <path d="M11 16l2-1 2 1-2 1-2-1z" />
    </svg>
  );
}

export function IconActivity(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...s(props)}>
      <path d="M4 12h3l3-6 4 12 3-6h3" />
    </svg>
  );
}
