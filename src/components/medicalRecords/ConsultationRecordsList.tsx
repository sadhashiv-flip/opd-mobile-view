import {
  MrIconCalendarToday,
  MrIconChevronRight,
  MrIconLocalHospital,
  MrIconVideocam,
} from "@/components/medicalRecords/MedicalRecordsIcons";
import { useToast } from "@/hooks/useToast";
import {
  consultationDoctorName,
  consultationDoctorSpecialty,
  consultationInvoiceId,
  consultationCommunicationLabel,
  consultationIsOnline,
  consultationStatusLabel,
  consultationStatusTone,
  formatConsultationDateTime,
  pickStr,
} from "@/lib/consultationRecordRow";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { useNavigate } from "react-router-dom";
import "./ConsultationRecordsList.css";

function avatarGradient(name: string): string {
  const palettes = [
    "linear-gradient(135deg, #ff5224 0%, #ffab40 100%)",
    "linear-gradient(135deg, #16a34a 0%, #86efac 100%)",
    "linear-gradient(135deg, #2563eb 0%, #93c5fd 100%)",
    "linear-gradient(135deg, #7c4dff 0%, #b388ff 100%)",
    "linear-gradient(135deg, #ff6d00 0%, #ffab40 100%)",
  ];
  let h = 0;
  for (const ch of name) {
    const cp = ch.codePointAt(0);
    if (cp != null) h = (h + cp * 17) % 997;
  }
  return palettes[Math.abs(h) % palettes.length];
}

function ConsultStatusChip({ label }: Readonly<{ label: string }>) {
  const tone = consultationStatusTone(label);
  const display = label;
  return (
    <span className={`mr-consult-status mr-consult-status--${tone}`}>
      <span className="mr-consult-status__dot" aria-hidden />
      {display}
    </span>
  );
}

export type ConsultationRecordsListProps = Readonly<{
  rows: readonly Record<string, unknown>[];
}>;

export function ConsultationRecordsList({ rows }: ConsultationRecordsListProps) {
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <ul className="mr-consult-list">
      {rows.map((row, i) => {
        const key = pickStr(row.id, row.appointment_id, row.appointmentId) || `row-${i}`;
        const name = consultationDoctorName(row);
        const spec = consultationDoctorSpecialty(row);
        const status = consultationStatusLabel(row);
        const when = formatConsultationDateTime(row);
        const invoiceId = consultationInvoiceId(row);
        const initial = name.trim().charAt(0).toUpperCase() || "D";
        const isOnline = consultationIsOnline(row);
        const commLabel = consultationCommunicationLabel(row);

        const onCardActivate = () => {
          if (!invoiceId) {
            toast.error("Order details are not available for this visit.");
            return;
          }
          navigate(pathToOrderDetail("consultation", invoiceId));
        };

        return (
          <li key={key}>
            <button type="button" className="mr-consult-card" onClick={onCardActivate}>
              <span
                className="mr-consult-card__avatar"
                style={{ background: avatarGradient(name) }}
                aria-hidden
              >
                {initial}
              </span>
              <span className="mr-consult-card__body">
                <span className="mr-consult-card__name-row">
                  <span className="mr-consult-card__name">{name}</span>
                  <ConsultStatusChip label={status} />
                </span>
                {spec ? <span className="mr-consult-card__spec">{spec}</span> : null}
                <span className="mr-consult-card__when-row">
                  <span className="mr-consult-card__when">
                    <MrIconCalendarToday size={13} />
                    {when}
                  </span>
                  <span
                    className={
                      isOnline
                        ? "mr-consult-card__comm mr-consult-card__comm--online"
                        : "mr-consult-card__comm mr-consult-card__comm--inperson"
                    }
                  >
                    {isOnline ? <MrIconVideocam size={11} /> : <MrIconLocalHospital size={11} />}
                    {commLabel}
                  </span>
                </span>
              </span>
              <span className="mr-consult-card__chevron" aria-hidden>
                <MrIconChevronRight />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
