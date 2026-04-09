import type { ReactNode } from "react";

export type InfoGridItem = Readonly<{
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
}>;

type InfoGridProps = Readonly<{
  items: readonly InfoGridItem[];
}>;

export function InfoGrid({ items }: InfoGridProps) {
  if (items.length === 0) return null;
  return (
    <ul className="profile-page__info-grid" role="list">
      {items.map((item) => (
        <li key={item.key} className="profile-page__info-cell">
          <span className="profile-page__info-cell-icon" aria-hidden>
            {item.icon}
          </span>
          <div className="profile-page__info-cell-text">
            <span className="profile-page__info-cell-label">{item.label}</span>
            <span className="profile-page__info-cell-value">{item.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
