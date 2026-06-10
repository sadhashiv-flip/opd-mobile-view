import "./OrderDetailRiderSection.css";

function CallIcon() {
  return (
    <svg className="od-rider-call__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" />
    </svg>
  );
}

function riderDialHref(contact: string): string | null {
  const digits = contact.replaceAll(/[^\d+]/g, "");
  return digits.length > 0 ? `tel:${digits}` : null;
}

type OrderDetailRiderSectionProps = Readonly<{
  name: string;
  contact: string;
  /** Full card (pharmacy / service request) vs nested block inside lab sub-order. */
  variant?: "card" | "embedded";
}>;

function RiderRows({ name, contact }: Readonly<{ name: string; contact: string }>) {
  const dialHref = riderDialHref(contact);
  const contactDisplay = contact.trim() || "—";
  const nameDisplay = name.trim() || "—";

  return (
    <>
      <div className="od-rider-line">
        <span className="od-rider-line__label">Name</span>
        <span className="od-rider-line__value">{nameDisplay}</span>
      </div>
      <div className="od-rider-line od-rider-line--contact">
        <span className="od-rider-line__label">Contact</span>
        <span className="od-rider-line__value">{contactDisplay}</span>
        {dialHref ? (
          <a className="od-rider-call" href={dialHref}>
            <CallIcon />
            <span>Call</span>
          </a>
        ) : null}
      </div>
    </>
  );
}

/** patient_app pharmacy / lab / service-request rider card — label rows + orange call CTA. */
export function OrderDetailRiderSection({
  name,
  contact,
  variant = "card",
}: OrderDetailRiderSectionProps) {
  if (variant === "embedded") {
    return (
      <div className="od-rider-embedded" aria-label="Rider details">
        <p className="od-rider-embedded__title">Rider details</p>
        <RiderRows name={name} contact={contact} />
      </div>
    );
  }

  return (
    <section className="od-rider-card" aria-label="Rider details">
      <h3 className="od-rider-card__title">Rider details</h3>
      <hr className="od-rider-card__divider" />
      <RiderRows name={name} contact={contact} />
    </section>
  );
}
