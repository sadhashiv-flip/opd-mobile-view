import type { ReactNode } from "react";
import {
  isInvoiceDetailCancelled,
  type ConsultationClinicalNotesUi,
  type ConsultationOfflineRescheduleUi,
  type ConsultationRescheduleLineUi,
  type InvoiceDetailModel,
} from "@/api/patientInvoices";
import { OrderDetailCancellationReason } from "@/components/orders/OrderDetailCancellationReason";
import { OrderDetailPatientSection } from "@/components/orders/OrderDetailSharedSections";
import {
  consultationDetailStatusLabel,
  consultationStatusBannerTone,
  showConsultationClinicalNotesSection,
  showConsultationFlipPrescriptionSection,
  showConsultationNetworkPrescriptionsSection,
  showConsultationOfflineRescheduleSection,
} from "@/lib/consultationOrderDetail";
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
  titleSuffix,
  children,
  ariaLabel,
}: Readonly<{
  title: string;
  titleSuffix?: string | null;
  children: ReactNode;
  ariaLabel?: string;
}>) {
  return (
    <section className="od-sr-card" aria-label={ariaLabel ?? title}>
      <div className="od-sr-card__head">
        <h3 className="od-sr-card__title">{title}</h3>
        {titleSuffix ? (
          <span
            className={`od-place-tag od-place-tag--${titleSuffix === "Virtual" ? "virtual" : "inPerson"}`}
          >
            {titleSuffix}
          </span>
        ) : null}
      </div>
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

function doctorInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (t[0] ?? "?").toUpperCase();
}

function RescheduleLines({ block }: Readonly<{ block: ConsultationRescheduleLineUi }>) {
  const rows: { text: string; bold?: boolean }[] = [];
  if (block.address?.trim()) rows.push({ text: block.address.trim() });
  if (block.name?.trim()) rows.push({ text: block.name.trim(), bold: true });
  if (block.timeSlot?.trim()) rows.push({ text: block.timeSlot.trim(), bold: true });
  if (rows.length === 0) return <p className="od-sr-muted">—</p>;
  return (
    <>
      {rows.map((row) => (
        <p
          key={row.text}
          className={row.bold ? "od-sr-reschedule-line od-sr-reschedule-line--bold" : "od-sr-reschedule-line"}
        >
          {row.text}
        </p>
      ))}
    </>
  );
}

function ClinicalNoteLine({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return (
    <div className="od-sr-clinical">
      <span className="od-sr-clinical__label">{label}</span>
      <p className="od-sr-clinical__text">{value?.trim() || "—"}</p>
    </div>
  );
}

function PrescriptionThumb({
  url,
  onPreview,
}: Readonly<{
  url: string;
  onPreview: () => void;
}>) {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  const isPdf = lower.endsWith(".pdf");
  return (
    <button
      type="button"
      className={`od-sr-att-thumb${isPdf ? " od-sr-att-thumb--pdf" : ""}`}
      onClick={onPreview}
      aria-label="Open file"
    >
      {isPdf ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      ) : (
        <img src={url} alt="" loading="lazy" />
      )}
    </button>
  );
}

export type OrderDetailConsultationSectionsProps = Readonly<{
  detail: InvoiceDetailModel;
  patientDetailsVisible: boolean;
  onPreviewUrl: (url: string, label: string) => void;
  onOpenFlipPrescription: () => void;
  onConfirmOfflineReschedule: () => void;
  offlineRescheduleConfirmBusy: boolean;
}>;

/**
 * Consultation order detail body — patient_app `ConsultationOrderDetailScreen`
 * section order, labels, and visibility.
 */
export function OrderDetailConsultationSections({
  detail,
  patientDetailsVisible,
  onPreviewUrl,
  onOpenFlipPrescription,
  onConfirmOfflineReschedule,
  offlineRescheduleConfirmBusy,
}: OrderDetailConsultationSectionsProps) {
  const status = detail.consultationInfoStatus;
  const slotExpired =
    detail.consultationPlaceTag === "virtual" &&
    status === 5 &&
    detail.consultationSlotStartMs != null &&
    Date.now() > detail.consultationSlotStartMs + 10 * 60 * 1000;
  const tone = consultationStatusBannerTone(detail, slotExpired);
  const statusLabel = consultationDetailStatusLabel(detail);
  const cancelReason = detail.orderCancellationReason?.trim() ?? "";
  const showCancelReason =
    cancelReason.length > 0 && isInvoiceDetailCancelled(detail) && status === 2;

  const placeSuffix =
    detail.consultationPlaceTag === "virtual"
      ? "Virtual"
      : detail.consultationPlaceTag === "inPerson"
        ? "In-person"
        : null;

  const apptId = detail.infoOrderIdFormatted ?? "—";
  const booking = detail.consultationBooking;
  const visitVisible =
    detail.consultationPlaceTag !== "virtual" &&
    booking != null &&
    [
      booking.clinicName,
      booking.doctorName,
      booking.specialty,
      booking.qualification,
      booking.experienceLabel,
      booking.addressLine,
    ].some((x) => x != null && String(x).trim().length > 0);

  const clinical = detail.consultationClinicalNotes;
  const offlineReschedule = detail.consultationOfflineReschedule;

  return (
    <div className="od-sr-stack">
      <div className={`od-sr-status od-sr-status--${tone}`} role="status" aria-live="polite">
        <StatusIcon status={status} />
        <div className="od-sr-status__body">
          <p className="od-sr-status__title">Status: {statusLabel}</p>
          {showCancelReason ? (
            <OrderDetailCancellationReason reason={cancelReason} variant="inline" />
          ) : null}
        </div>
      </div>

      <SrSection title="Appointment" titleSuffix={placeSuffix} ariaLabel="Appointment">
        <p className="od-sr-appt-id">{apptId}</p>
        {booking?.scheduleDisplay ? (
          <SrLine label="Schedule" value={booking.scheduleDisplay} />
        ) : null}
        {detail.consultationPurpose ? (
          <SrLine label="Purpose" value={detail.consultationPurpose} />
        ) : null}
      </SrSection>

      {patientDetailsVisible ? (
        <OrderDetailPatientSection
          patientName={detail.patientName}
          consultationPatient={detail.consultationPatient}
          alternatePhone={detail.infoDetailsAlternatePhone}
          userAddress={detail.pharmacyOrderLocation}
        />
      ) : null}

      {detail.consultationPlaceTag === "virtual" && detail.consultationOrderDoctor ? (
        <SrSection title="Doctor details" ariaLabel="Doctor details">
          <div className="od-doc">
            <div className="od-doc__avatar-wrap">
              {detail.consultationOrderDoctor.imageUrl ? (
                <img
                  className="od-doc__avatar"
                  src={detail.consultationOrderDoctor.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                />
              ) : (
                <div className="od-doc__avatar od-doc__avatar--placeholder" aria-hidden>
                  {doctorInitial(detail.consultationOrderDoctor.name)}
                </div>
              )}
            </div>
            <div className="od-doc__meta">
              <p className="od-doc__name">{detail.consultationOrderDoctor.name}</p>
              <p className="od-doc__spec">{detail.consultationOrderDoctor.speciality}</p>
            </div>
          </div>
        </SrSection>
      ) : null}

      {visitVisible && booking ? (
        <SrSection title="Visit details" ariaLabel="Visit details">
          {booking.clinicName ? <p className="od-sr-visit-name">{booking.clinicName}</p> : null}
          {booking.doctorName ? <p className="od-sr-visit-name">{booking.doctorName}</p> : null}
          {booking.specialty ? <p className="od-sr-visit-meta">{booking.specialty}</p> : null}
          {booking.qualification ? <p className="od-sr-visit-meta">{booking.qualification}</p> : null}
          {booking.experienceLabel ? <p className="od-sr-visit-meta">{booking.experienceLabel}</p> : null}
          {booking.addressLine ? (
            <div className="od-sr-center-addr-row">
              <p className="od-sr-center-addr">{booking.addressLine}</p>
              {booking.mapsUrl ? (
                <a
                  className="od-sr-center-map-icon"
                  href={booking.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Directions"
                >
                  <NavMapIcon />
                </a>
              ) : null}
            </div>
          ) : null}
        </SrSection>
      ) : null}

      {showConsultationClinicalNotesSection(detail) && clinical ? (
        <SrSection title="Consultation notes" ariaLabel="Consultation notes">
          <ClinicalNotesBlock notes={clinical} />
        </SrSection>
      ) : null}

      {showConsultationOfflineRescheduleSection(detail) && offlineReschedule ? (
        <SrSection title="Booking changes" ariaLabel="Booking changes">
          <OfflineRescheduleBlock
            data={offlineReschedule}
            busy={offlineRescheduleConfirmBusy}
            onConfirm={onConfirmOfflineReschedule}
          />
        </SrSection>
      ) : null}

      {showConsultationNetworkPrescriptionsSection(detail) ? (
        <SrSection title="Prescriptions" ariaLabel="Prescriptions">
          <div className="od-sr-att-grid">
            {detail.consultationNetworkPrescriptionUrls.map((url) => (
              <PrescriptionThumb
                key={url}
                url={url}
                onPreview={() => onPreviewUrl(url, "Prescription")}
              />
            ))}
          </div>
        </SrSection>
      ) : null}

      {showConsultationFlipPrescriptionSection(detail) ? (
        <SrSection title="Prescription" ariaLabel="Prescription">
          <button type="button" className="od-sr-flip-rx" onClick={onOpenFlipPrescription}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            <span className="od-sr-flip-rx__label">View prescription report</span>
            <span className="od-sr-flip-rx__chev" aria-hidden>
              ›
            </span>
          </button>
        </SrSection>
      ) : null}
    </div>
  );
}

function ClinicalNotesBlock({ notes }: Readonly<{ notes: ConsultationClinicalNotesUi }>) {
  return (
    <>
      <ClinicalNoteLine label="Symptoms" value={notes.symptoms} />
      <ClinicalNoteLine label="Patient history" value={notes.history} />
      <ClinicalNoteLine label="Diagnosis" value={notes.diagnosis} />
      <ClinicalNoteLine label="Recommendations" value={notes.recommendation} />
    </>
  );
}

function OfflineRescheduleBlock({
  data,
  busy,
  onConfirm,
}: Readonly<{
  data: ConsultationOfflineRescheduleUi;
  busy: boolean;
  onConfirm: () => void;
}>) {
  return (
    <>
      <p className="od-sr-reschedule-heading">Requested</p>
      <RescheduleLines block={data.requested} />
      <p className="od-sr-reschedule-heading od-sr-reschedule-heading--spaced">Modified</p>
      <RescheduleLines block={data.modified} />
      <button
        type="button"
        className="od-sr-confirm-changes"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? "Confirming…" : "Confirm changes"}
      </button>
    </>
  );
}
