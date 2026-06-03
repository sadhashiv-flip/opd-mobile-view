import type { MedicalRecordCategoryDef } from "@/constants/medicalRecordsCategories";
import {
  MrIconAccessTime,
  MrIconChevronRight,
  MrIconLocationOn,
  MrIconVideocam,
  ServiceRequestCardIcon,
  type ServiceRequestIconKind,
} from "@/components/medicalRecords/MedicalRecordsIcons";
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
  Record<string, Readonly<{ gradient: string; icon: ServiceRequestIconKind }>>
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

function VisitTypeBadge({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const online = serviceRequestIsOnlineVisit(row);
  const label = serviceRequestVisitTypeLabel(row);
  return (
    <span className={`mr-sr-visit${online ? " mr-sr-visit--online" : " mr-sr-visit--inperson"}`}>
      {online ? <MrIconVideocam size={11} /> : <MrIconLocationOn size={11} />}
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
                <ServiceRequestCardIcon kind={theme.icon} />
              </span>
              <span className="mr-record-card__body">
                <span className="mr-sr-card__title">{title}</span>
                {area ? <span className="mr-sr-card__area">{area}</span> : null}
                {when ? (
                  <span className="mr-sr-card__time-row">
                    <MrIconAccessTime size={13} />
                    <span>{when}</span>
                  </span>
                ) : null}
                <VisitTypeBadge row={row} />
              </span>
              <span className="mr-record-card__chevron" aria-hidden>
                <MrIconChevronRight />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
