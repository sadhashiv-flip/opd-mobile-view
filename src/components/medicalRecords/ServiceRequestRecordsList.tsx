import type { MedicalRecordCategoryDef } from "@/constants/medicalRecordsCategories";
import {
  pickStr,
  serviceRequestArea,
  serviceRequestDisplayTime,
  serviceRequestIsOnlineVisit,
  serviceRequestTitle,
  serviceRequestVisitTypeLabel,
} from "@/lib/medicalRecordRow";
import "./MedicalRecordsCards.css";
import "./ServiceRequestRecordsList.css";

const SERVICE_CARD_THEME: Readonly<
  Record<string, Readonly<{ gradient: string; icon: "psychology" | "restaurant" | "dental" | "vision" | "vaccine" }>>
> = {
  "mental-wellness": {
    gradient: "linear-gradient(135deg, #7c4dff 0%, #b388ff 100%)",
    icon: "psychology",
  },
  nutrition: {
    gradient: "linear-gradient(135deg, #ff7043 0%, #ffab91 100%)",
    icon: "restaurant",
  },
  dental: {
    gradient: "linear-gradient(135deg, #26c6da 0%, #80deea 100%)",
    icon: "dental",
  },
  vision: {
    gradient: "linear-gradient(135deg, #5c6bc0 0%, #9fa8da 100%)",
    icon: "vision",
  },
  vaccine: {
    gradient: "linear-gradient(135deg, #66bb6a 0%, #a5d6a7 100%)",
    icon: "vaccine",
  },
};

function ServiceIcon({ kind }: Readonly<{ kind: string }>) {
  const stroke = "#fff";
  switch (kind) {
    case "psychology":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a7 7 0 00-4 12.7V19h8v-3.3A7 7 0 0012 3z"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "restaurant":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 3v8M10 3v8M6 11v10M10 11v10M14 3v18M18 3v7a3 3 0 01-3 3"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "dental":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 4c-3 0-5 2-5 5 0 4 2 7 5 11 3-4 5-7 5-11 0-3-2-5-5-5z"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "vision":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
            stroke={stroke}
            strokeWidth="1.75"
          />
          <circle cx="12" cy="12" r="2.5" stroke={stroke} strokeWidth="1.75" />
        </svg>
      );
    case "vaccine":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M14 3l7 7-9 9-7-7 9-9zM5 21l2-2"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function VisitTypeBadge({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const online = serviceRequestIsOnlineVisit(row);
  const label = serviceRequestVisitTypeLabel(row);
  return (
    <span className={`mr-sr-visit${online ? " mr-sr-visit--online" : " mr-sr-visit--inperson"}`}>
      {online ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 10l4.55-2.73a1 1 0 011.45.87v8.72a1 1 0 01-1.45.87L15 14M5 7h8a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20v-1a7 7 0 0114 0v1"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span>{label}</span>
    </span>
  );
}

export type ServiceRequestRecordsListProps = Readonly<{
  category: MedicalRecordCategoryDef;
  rows: readonly Record<string, unknown>[];
  onOpen: (row: Record<string, unknown>) => void;
}>;

/** Mirrors Flutter `ServiceRequestCard` (mental wellness, nutrition, dental, vision, vaccine). */
export function ServiceRequestRecordsList({ category, rows, onOpen }: ServiceRequestRecordsListProps) {
  const theme = SERVICE_CARD_THEME[category.slug] ?? SERVICE_CARD_THEME["mental-wellness"];

  return (
    <ul className="mr-records-list">
      {rows.map((row, i) => {
        const key = pickStr(row.id) || `svc-${i}`;
        const title = serviceRequestTitle(row);
        const area = serviceRequestArea(row);
        const when = serviceRequestDisplayTime(row);

        return (
          <li key={key}>
            <button type="button" className="mr-record-card mr-sr-card" onClick={() => onOpen(row)}>
              <span
                className="mr-record-card__icon mr-record-card__icon--gradient"
                style={{ background: theme.gradient }}
                aria-hidden
              >
                <ServiceIcon kind={theme.icon} />
              </span>
              <span className="mr-record-card__body">
                <span className="mr-sr-card__title">{title}</span>
                {area ? <span className="mr-sr-card__area">{area}</span> : null}
                {when ? (
                  <span className="mr-sr-card__time-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>{when}</span>
                  </span>
                ) : null}
                <VisitTypeBadge row={row} />
              </span>
              <span className="mr-record-card__chevron" aria-hidden>
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
