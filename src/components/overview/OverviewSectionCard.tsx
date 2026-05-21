import type { ReactNode } from "react";
import "./OverviewSectionCard.css";

export type OverviewSectionCardProps = Readonly<{
  title: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}>;

/** patient_app `OverviewSectionCard` — shared overview section shell. */
export function OverviewSectionCard({ title, icon, trailing, children }: OverviewSectionCardProps) {
  return (
    <section className="overview-section-card">
      <header className="overview-section-card__head">
        {icon ? <span className="overview-section-card__icon" aria-hidden>{icon}</span> : null}
        <h2 className="overview-section-card__title">{title}</h2>
        {trailing ? <span className="overview-section-card__trailing">{trailing}</span> : null}
      </header>
      <div className="overview-section-card__body">{children}</div>
    </section>
  );
}

export function OverviewIconClinic() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 9h2V5h4V3H3v6zm14-6h-4v2h4v4h2V3h-2zm4 14h-2v4h-4v2h6v-6zm-14 6v-2H3v-4H1v6h6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function OverviewIconMedical() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v20M5 9h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OverviewIconCall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.7 3.6.7.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.3 2.4.7 3.6.2.3.1.7-.2 1L6.6 10.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OverviewIconEvent() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
