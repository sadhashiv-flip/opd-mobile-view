import type { ReactNode } from "react";

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
  badge,
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
      {badge === "new" ? (
        <span className="service-hub-card__badge">New</span>
      ) : null}
      <div className="service-hub-card__icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="service-hub-card__title">{title}</h3>
      <p className="service-hub-card__desc">{description}</p>
    </article>
  );
}
