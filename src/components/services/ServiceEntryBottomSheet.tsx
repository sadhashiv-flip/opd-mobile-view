import { MdClose } from "react-icons/md";
import { ServiceEntryOptionCard } from "@/components/services/ServiceEntryOptionCard";
import "./ServiceEntryBottomSheet.css";

export type ServiceEntrySheetItem = Readonly<{
  key: string;
  iconSrc: string;
  title: string;
  subtitle: string;
  subtitleIconSrc: string;
  onClick: () => void;
}>;

export type ServiceEntryBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  items: readonly ServiceEntrySheetItem[];
}>;

/** Shared service entry sheet — matches Flutter `CommonBottomSheet`. */
export function ServiceEntryBottomSheet({
  open,
  onClose,
  title,
  ariaLabel,
  items,
}: ServiceEntryBottomSheetProps) {
  if (!open || items.length === 0) {
    return null;
  }

  return (
    <dialog
      className="home-sheet-dialog"
      open
      aria-label={ariaLabel ?? title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="home-sheet home-sheet--service-entry">
        <header className="home-sheet__header home-sheet__header--service-entry">
          <h3 className="home-sheet__title home-sheet__title--service-entry">{title}</h3>
          <button
            type="button"
            className="home-sheet__close home-sheet__close--circle"
            aria-label="Close"
            onClick={onClose}
          >
            <MdClose size={20} aria-hidden />
          </button>
        </header>

        <div className="service-entry-sheet__grid">
          {items.map((item) => (
            <ServiceEntryOptionCard
              key={item.key}
              iconSrc={item.iconSrc}
              title={item.title}
              subtitle={item.subtitle}
              subtitleIconSrc={item.subtitleIconSrc}
              onClick={item.onClick}
            />
          ))}
        </div>
      </section>
    </dialog>
  );
}
