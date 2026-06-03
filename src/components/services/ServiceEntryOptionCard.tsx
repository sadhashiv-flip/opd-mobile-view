import { MdOutlineNorthEast } from "react-icons/md";
import "./ServiceEntryOptionCard.css";

export type ServiceEntryOptionCardProps = Readonly<{
  iconSrc: string;
  title: string;
  subtitle: string;
  subtitleIconSrc: string;
  onClick: () => void;
}>;

/** Matches Flutter `ServiceCard` in `common_bottom_sheet.dart`. */
export function ServiceEntryOptionCard({
  iconSrc,
  title,
  subtitle,
  subtitleIconSrc,
  onClick,
}: ServiceEntryOptionCardProps) {
  return (
    <button type="button" className="service-entry-option-card" onClick={onClick}>
      <div className="service-entry-option-card__top">
        <span className="service-entry-option-card__icon-wrap" aria-hidden>
          <img src={iconSrc} alt="" draggable={false} />
        </span>
        <MdOutlineNorthEast className="service-entry-option-card__arrow" aria-hidden />
      </div>
      <span className="service-entry-option-card__title">{title}</span>
      <span className="service-entry-option-card__sub">
        <img
          src={subtitleIconSrc}
          alt=""
          draggable={false}
          className="service-entry-option-card__sub-icon"
        />
        <span className="service-entry-option-card__sub-text">{subtitle}</span>
      </span>
    </button>
  );
}
