import type { ReactNode } from "react";
import "./WellnessSectionCard.css";

export function WellnessSectionCard({
  title,
  icon,
  children,
}: Readonly<{
  title: string;
  icon: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className="wellness-section-card">
      <div className="wellness-section-card__head">
        <span className="wellness-section-card__icon" aria-hidden>
          {icon}
        </span>
        <h2 className="wellness-section-card__title">{title}</h2>
      </div>
      <div className="wellness-section-card__divider" aria-hidden />
      <div className="wellness-section-card__body">{children}</div>
    </section>
  );
}
