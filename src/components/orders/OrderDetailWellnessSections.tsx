import type { InvoiceDetailModel } from "@/api/patientInvoices";
import { OrderDetailCancellationReason } from "@/components/orders/OrderDetailCancellationReason";
import {
  wellnessOrderStatusLabel,
  wellnessStatusBannerTone,
} from "@/lib/wellnessOrderDetail";
import "./OrderDetailWellnessSections.css";

function StatusIcon({ tone }: Readonly<{ tone: ReturnType<typeof wellnessStatusBannerTone> }>) {
  if (tone === "success") {
    return (
      <svg className="od-wellness-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg className="od-wellness-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
      </svg>
    );
  }
  return (
    <svg className="od-wellness-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  );
}

export type OrderDetailWellnessSectionsProps = Readonly<{
  detail: InvoiceDetailModel;
}>;

export function OrderDetailWellnessSections({ detail }: OrderDetailWellnessSectionsProps) {
  const status = detail.serviceInfoStatus;
  const tone = wellnessStatusBannerTone(status);
  const label = wellnessOrderStatusLabel(status, detail.categoryKey);
  const cancelReason = detail.orderCancellationReason?.trim() ?? "";
  const showCancelReason = status === 2 && cancelReason.length > 0;
  const orderId = detail.consultationInfoId?.trim();
  const service = detail.wellnessServiceType?.trim() || detail.serviceTypeLabel || "—";
  const consultType = detail.wellnessConsultationType?.trim();

  return (
    <>
      <section className={`od-wellness-status od-wellness-status--${tone}`} aria-label="Order status">
        <StatusIcon tone={tone} />
        <div className="od-wellness-status__body">
          <p className="od-wellness-status__title">Status: {label}</p>
          {showCancelReason ? (
            <OrderDetailCancellationReason reason={cancelReason} />
          ) : null}
        </div>
      </section>

      <section className="od-card" aria-label="Order summary">
        <h3 className="od-card__title">Order summary</h3>
        <div className="od-row">
          <span className="od-row__label">Order ID</span>
          <span className="od-row__value od-row__value--other">
            {orderId ? `#${orderId}` : "—"}
          </span>
        </div>
      </section>

      <section className="od-card" aria-label="Service details">
        <h3 className="od-card__title">Service details</h3>
        <div className="od-row">
          <span className="od-row__label">Service type</span>
          <span className="od-row__value od-row__value--other">{service}</span>
        </div>
        {service !== "Diet & Nutrition" && consultType ? (
          <div className="od-row">
            <span className="od-row__label">Consultation type</span>
            <span className="od-row__value od-row__value--other">{consultType}</span>
          </div>
        ) : null}
      </section>
    </>
  );
}
