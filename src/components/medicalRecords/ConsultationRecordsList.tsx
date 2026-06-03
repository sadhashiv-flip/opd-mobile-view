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
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M8 2v3M16 2v3M4 9h16M6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                    {when}
                  </span>
                  <span
                    className={
                      isOnline
                        ? "mr-consult-card__comm mr-consult-card__comm--online"
                        : "mr-consult-card__comm mr-consult-card__comm--inperson"
                    }
                  >
                    {isOnline ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {commLabel}
                  </span>
                </span>
              </span>
              <span className="mr-consult-card__chevron" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
