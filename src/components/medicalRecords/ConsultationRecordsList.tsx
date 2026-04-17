import { fetchInvoiceById } from "@/api/patientInvoices";
import { useToast } from "@/hooks/useToast";
import {
  consultationAppointmentId,
  consultationDoctorImageUrl,
  consultationDoctorName,
  consultationDoctorSpecialty,
  consultationInvoiceId,
  consultationCommunicationLabel,
  consultationIsOnline,
  consultationStatusLabel,
  formatConsultationDateTime,
  pickStr,
} from "@/lib/consultationRecordRow";
import { pathToMedicalRecordsConsultationChat } from "@/lib/medicalRecordsRoutes";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./ConsultationRecordsList.css";

function avatarGradient(name: string): string {
  const palettes = [
    "linear-gradient(135deg, #ff6d00 0%, #ffab40 100%)",
    "linear-gradient(135deg, #0d9488 0%, #5eead4 100%)",
    "linear-gradient(135deg, #2563eb 0%, #93c5fd 100%)",
    "linear-gradient(135deg, #7c3aed 0%, #c4b5fd 100%)",
    "linear-gradient(135deg, #db2777 0%, #fbcfe8 100%)",
  ];
  let h = 0;
  for (const ch of name) {
    const cp = ch.codePointAt(0);
    if (cp != null) h = (h + cp * 17) % 997;
  }
  return palettes[Math.abs(h) % palettes.length];
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
        const appointmentId = consultationAppointmentId(row);
        const imgRaw = consultationDoctorImageUrl(row);
        const img = imgRaw ? resolveProfileImageUrl(imgRaw) ?? undefined : undefined;
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

        const onChat = (e: MouseEvent) => {
          e.preventDefault();
          if (!isOnline) return;
          void (async () => {
            let aid = appointmentId;
            if (!aid && invoiceId) {
              try {
                const detail = await fetchInvoiceById(invoiceId);
                aid = pickStr(detail.consultationUploadRefId, detail.consultationInfoId);
              } catch {
                toast.error("Could not load this order to open chat.");
                return;
              }
            }
            if (!aid) {
              toast.error("Chat is not available for this visit.");
              return;
            }
            navigate(pathToMedicalRecordsConsultationChat(aid));
          })();
        };

        return (
          <li key={key}>
            <div className="mr-consult-card">
              <button type="button" className="mr-consult-card__main" onClick={onCardActivate}>
                <div className="mr-consult-card__left">
                  {img ? (
                    <img className="mr-consult-card__avatar-img" src={img} alt="" />
                  ) : (
                    <div
                      className="mr-consult-card__avatar"
                      style={{ background: avatarGradient(name) }}
                      aria-hidden
                    >
                      {initial}
                    </div>
                  )}
                  <div className="mr-consult-card__info">
                    <div className="mr-consult-card__name-row">
                      <span className="mr-consult-card__name">{name}</span>
                    </div>
                    {spec ? <span className="mr-consult-card__spec">{spec}</span> : null}
                    <div className="mr-consult-card__when-row">
                      <span className="mr-consult-card__when">{when}</span>
                      <span
                        className={
                          isOnline
                            ? "mr-consult-card__comm mr-consult-card__comm--online"
                            : "mr-consult-card__comm mr-consult-card__comm--inperson"
                        }
                      >
                        {isOnline ? (
                          <svg className="mr-consult-card__comm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg className="mr-consult-card__comm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {commLabel}
                      </span>
                    </div>
                    <span className="mr-consult-card__status">
                      {"Status : "}
                      <span className="mr-consult-card__status-val">{status}</span>
                    </span>
                  </div>
                </div>
                <span className="mr-consult-card__chevron" aria-hidden>
                  ›
                </span>
              </button>
              {isOnline ? (
                <div className="mr-consult-card__side">
                  <button type="button" className="mr-consult-card__chat" onClick={onChat}>
                    <span className="mr-consult-card__chat-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M8 10h8M8 14h5M5 19l1.4-3.2c-1.8-1.4-2.9-3.5-2.9-5.8C3.5 6.6 7.4 3 12.3 3c4.8 0 8.7 3.6 8.7 8S17.1 19 12.3 19c-1.2 0-2.3-.2-3.4-.6L5 21z"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    Chat
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
