import type { ReactNode } from "react";

export type InfoValueTone = "default" | "blood" | "contact";

export type InfoGridItem = Readonly<{
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
  valueTone?: InfoValueTone;
}>;

type InfoGridProps = Readonly<{
  items: readonly InfoGridItem[];
}>;

export function InfoGrid({ items }: InfoGridProps) {
  if (items.length === 0) return null;
  return (
    <ul className="profile-page__info-list" role="list">
      {items.map((item, index) => (
        <li
          key={item.key}
          className={`profile-page__info-row${index < items.length - 1 ? " profile-page__info-row--divider" : ""}`}
        >
          <span className="profile-page__info-cell-icon" aria-hidden>
            {item.icon}
          </span>
          <div className="profile-page__info-cell-text">
            <span className="profile-page__info-cell-label">{item.label}</span>
            <span
              className={`profile-page__info-cell-value${
                item.valueTone === "blood"
                  ? " profile-page__info-cell-value--blood"
                  : item.valueTone === "contact"
                    ? " profile-page__info-cell-value--contact"
                    : ""
              }`}
            >
              {item.value}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
