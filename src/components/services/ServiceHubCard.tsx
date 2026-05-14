import type { ReactNode } from "react";
import "./ServiceHubCard.css";

export type ServiceHubCardProps = Readonly<{
  icon: ReactNode;
  title: string;
  description: string;
  badge?: "new";
  selected?: boolean;
  onClick?: () => void;
}>;

export function ServiceHubCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: ServiceHubCardProps) {
  return (
    <article
      className={`service-hub-card${selected ? " service-hub-card--selected" : ""}${onClick ? " service-hub-card--interactive" : ""}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
     
      {icon ? (
        <div className="service-hub-card__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="service-hub-card__body">
        <h3 className="service-hub-card__title">{title}</h3>
        <p className="service-hub-card__desc">{description}</p>
      </div>
      {onClick ? (
        <span className="service-hub-card__action" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : null}
    </article>
  );
}
