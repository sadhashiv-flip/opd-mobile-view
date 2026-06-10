import type { ReactNode } from "react";
import {
  isInvoiceDetailCancelled,
  type ConsultationAttachmentRow,
  type InvoiceDetailModel,
} from "@/api/patientInvoices";
import { OrderDetailCancellationReason } from "@/components/orders/OrderDetailCancellationReason";
import { OrderDetailRiderSection } from "@/components/orders/OrderDetailRiderSection";
import { serviceRequestStatusBannerTone } from "@/lib/serviceRequestOrderDetail";
import "./OrderDetailServiceRequestSections.css";

function NavMapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
    </svg>
  );
}

function StatusIcon({ status }: Readonly<{ status: number | null }>) {
  const n = status ?? -1;
  if (n === 1 || n === 6) {
    return (
      <svg className="od-sr-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    );
  }
  if (n === 2 || n === 9) {
    return (
      <svg className="od-sr-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
      </svg>
    );
  }
  if (n === 4) {
    return (
      <svg className="od-sr-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM12 10c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
      </svg>
    );
  }
  if (n === 5) {
    return (
      <svg className="od-sr-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z" />
      </svg>
    );
  }
  return (
    <svg className="od-sr-status__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  );
}

function SrSection({
  title,
  children,
  ariaLabel,
}: Readonly<{
  title: string;
  children: ReactNode;
  ariaLabel?: string;
}>) {
  return (
    <section className="od-sr-card" aria-label={ariaLabel ?? title}>
      <h3 className="od-sr-card__title">{title}</h3>
      <hr className="od-sr-card__divider" />
      {children}
    </section>
  );
}

function SrLine({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="od-sr-line">
      <span className="od-sr-line__label">{label}</span>
      <span className="od-sr-line__value">{value}</span>
    </div>
  );
}

function SrSummaryRow({
  label,
  value,
  preserveLineBreaks = false,
}: Readonly<{ label: string; value: string; preserveLineBreaks?: boolean }>) {
  return (
    <div className="od-sr-summary-row">
      <span className="od-sr-summary-row__label">{label}</span>
      <span
        className={`od-sr-summary-row__value${preserveLineBreaks ? " od-sr-summary-row__value--address" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function isImageAttachmentUrl(url: string | null, label: string): boolean {
  const probe = (url ?? label).toLowerCase().split("?")[0] ?? "";
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(probe);
}

function isPdfAttachment(url: string | null, label: string): boolean {
  const probe = (url ?? label).toLowerCase().split("?")[0] ?? "";
  return probe.endsWith(".pdf");
}

function AttachmentThumb({
  item,
  onPreview,
}: Readonly<{
  item: ConsultationAttachmentRow;
  onPreview: (item: ConsultationAttachmentRow) => void;
}>) {
  const url = item.url;
  const isPdf = isPdfAttachment(url, item.label);
  const isImage = isImageAttachmentUrl(url, item.label);

  return (
    <button
      type="button"
      className={`od-sr-att-thumb${isPdf ? " od-sr-att-thumb--pdf" : ""}`}
      aria-label={item.label}
      onClick={() => onPreview(item)}
    >
      {isPdf ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      ) : isImage && url ? (
        <img src={url} alt="" loading="lazy" />
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" />
        </svg>
      )}
    </button>
  );
}

export type OrderDetailServiceRequestSectionsProps = Readonly<{
  detail: InvoiceDetailModel;
  orderReferenceValue: string;
  onOpenConfirmDialog: () => void;
  onPreviewAttachment: (item: ConsultationAttachmentRow) => void;
}>;

/**
 * Dental / vision / vaccine — full body matching patient_app
 * `ServiceRequestOrderDetailScreen` section order, labels, and visibility.
 */
export function OrderDetailServiceRequestSections({
  detail,
  orderReferenceValue,
  onOpenConfirmDialog,
  onPreviewAttachment,
}: OrderDetailServiceRequestSectionsProps) {
  const status = detail.serviceInfoStatus;
  const tone = serviceRequestStatusBannerTone(status);
  const requestBullets = detail.serviceRequestRequestBullets;
  const showRequestList = requestBullets.length > 0;
  const center = detail.showServiceRequestSelfVisitCenter ? detail.pharmacyConfirmCenter : null;
  const canConfirmCenter = detail.pharmacyAwaitingDetailConfirmation;
  const cancelReason = detail.orderCancellationReason?.trim() ?? "";
  const showCancelReason =
    cancelReason.length > 0 && isInvoiceDetailCancelled(detail);
  const preferredSlot =
    detail.pharmacyPreferredSlotDisplay?.trim() || "—";

  const centerAddr = center?.centerAddress?.trim() || "—";
  const centerMapsUrl = center?.mapsUrl?.trim() || null;
  const showCenterMapIcon = centerAddr !== "—" && centerAddr.length > 0;

  return (
    <div className="od-sr-stack">
      <div className={`od-sr-status od-sr-status--${tone}`} role="status" aria-live="polite">
        <StatusIcon status={status} />
        <div className="od-sr-status__body">
          <p className="od-sr-status__title">Status: {detail.serviceRequestStatusLabel}</p>
          {showCancelReason ? (
            <OrderDetailCancellationReason reason={cancelReason} variant="inline" />
          ) : null}
        </div>
      </div>

      <SrSection title="Order summary" ariaLabel="Order summary">
        <SrSummaryRow label="Order ID" value={orderReferenceValue} />
        <SrSummaryRow label="Created at" value={detail.serviceRequestCreatedAtDisplay} />
        <SrSummaryRow label="Visit type" value={detail.serviceVisitTypeLabel ?? "—"} />
        <SrSummaryRow
          label="Address"
          value={detail.serviceRequestSummaryAddress}
          preserveLineBreaks
        />
      </SrSection>

      <SrSection title="Patient Details" ariaLabel="Patient details">
        {detail.serviceRequestPatientRows.map((row, i) => (
          <SrLine
            key={`${row.label}-${i}`}
            label={row.label}
            value={row.value}
          />
        ))}
      </SrSection>

      <SrSection title="Requested details" ariaLabel="Requested details">
        {showRequestList ? (
          requestBullets.map((label) => (
            <p key={label} className="od-sr-bullet">
              • {label}
            </p>
          ))
        ) : (
          <SrLine label="Preferred slot" value={preferredSlot} />
        )}
        <SrLine label="Visit type" value={detail.serviceVisitTypeLabel ?? "—"} />
      </SrSection>

      {center != null ? (
        <SrSection title="Center details" ariaLabel="Center details">
          <p className="od-sr-center-name">{center.centerName?.trim() || "—"}</p>
          <div className="od-sr-center-addr-row">
            <p className="od-sr-center-addr">{centerAddr}</p>
            {showCenterMapIcon && centerMapsUrl ? (
              <a
                className="od-sr-center-map-icon"
                href={centerMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Directions"
              >
                <NavMapIcon />
              </a>
            ) : null}
          </div>
          {center.centerPhone?.trim() ? (
            <p className="od-sr-center-phone">Phone: {center.centerPhone.trim()}</p>
          ) : null}
          <div className="od-sr-center-actions">
            {centerMapsUrl ? (
              <a
                className="od-pharm-center__btn od-pharm-center__btn--outline"
                href={centerMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <NavMapIcon />
                <span>Directions</span>
              </a>
            ) : (
              <span className="od-pharm-center__btn od-pharm-center__btn--outline od-pharm-center__btn--disabled">
                <span>Directions</span>
              </span>
            )}
            {canConfirmCenter ? (
              <button
                type="button"
                className="od-pharm-center__btn od-pharm-center__btn--primary"
                onClick={onOpenConfirmDialog}
              >
                Confirm details
              </button>
            ) : null}
          </div>
        </SrSection>
      ) : null}

      {detail.consultationAttachments.length > 0 ? (
        <SrSection title="Attachments" ariaLabel="Attachments">
          <div className="od-sr-att-grid">
            {detail.consultationAttachments.map((item) => (
              <AttachmentThumb
                key={`${item.label}-${item.url ?? "no-url"}`}
                item={item}
                onPreview={onPreviewAttachment}
              />
            ))}
          </div>
        </SrSection>
      ) : null}

      {detail.consultationReports.length > 0 ? (
        <SrSection title="Reports" ariaLabel="Reports">
          <div className="od-sr-att-grid">
            {detail.consultationReports.map((item) => (
              <AttachmentThumb
                key={`${item.label}-${item.url ?? "no-url"}`}
                item={item}
                onPreview={onPreviewAttachment}
              />
            ))}
          </div>
        </SrSection>
      ) : null}

      {detail.showServiceRequestRiderCard && detail.serviceRequestRider != null ? (
        <OrderDetailRiderSection
          name={detail.serviceRequestRider.name}
          contact={detail.serviceRequestRider.contact}
        />
      ) : null}
    </div>
  );
}
