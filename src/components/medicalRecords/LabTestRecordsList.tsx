import {
  LabTestCardIcon,
  MrIconCalendarToday,
  MrIconChevronRight,
  MrIconHome,
  MrIconLocationOn,
} from "@/components/medicalRecords/MedicalRecordsIcons";
import {
  labTestCategory,
  labTestCollectionSlot,
  labTestDisplayDate,
  labTestIsHomePickup,
  labTestIsSponsored,
  labTestStatusLabel,
  labTestStatusTone,
  labTestTitle,
  pickStr,
} from "@/lib/medicalRecordRow";
import "./LabTestRecordsList.css";

export type LabTestRecordsListProps = Readonly<{
  rows: readonly Record<string, unknown>[];
  onOpen: (row: Record<string, unknown>) => void;
}>;

function labIconGradient(category: string): string {
  if (category.toLowerCase() === "radiology") {
    return "linear-gradient(135deg, #7c4dff 0%, #b388ff 100%)";
  }
  return "linear-gradient(135deg, #2563eb 0%, #5eead4 100%)";
}

function LabStatusChip({ label }: Readonly<{ label: string }>) {
  const tone = labTestStatusTone(label);
  return (
    <span className={`mr-lab-status mr-lab-status--${tone}`}>
      <span className="mr-lab-status__dot" aria-hidden />
      {label}
    </span>
  );
}

function VisitTypeBadge({ homePickup }: Readonly<{ homePickup: boolean }>) {
  const label = homePickup ? "Home Pickup" : "Self Visit";
  return (
    <span className={`mr-lab-visit${homePickup ? " mr-lab-visit--home" : " mr-lab-visit--center"}`}>
      {homePickup ? <MrIconHome size={11} /> : <MrIconLocationOn size={11} />}
      {label}
    </span>
  );
}

export function LabTestRecordsList({ rows, onOpen }: LabTestRecordsListProps) {
  return (
    <ul className="mr-lab-list">
      {rows.map((row, i) => {
        const key = pickStr(row.id) || `lab-${i}`;
        const category = labTestCategory(row);
        const title = labTestTitle(row);
        const status = labTestStatusLabel(row);
        const date = labTestDisplayDate(row);
        const slot = labTestCollectionSlot(row);
        const home = labTestIsHomePickup(row);
        const sponsored = labTestIsSponsored(row);

        return (
          <li key={key}>
            <button type="button" className="mr-lab-card" onClick={() => onOpen(row)}>
              <span
                className="mr-lab-card__icon"
                style={{ background: labIconGradient(category) }}
                aria-hidden
              >
                <LabTestCardIcon category={category} />
              </span>
              <span className="mr-lab-card__body">
                <span className="mr-lab-card__title-row">
                  <span className="mr-lab-card__title">{title}</span>
                  <LabStatusChip label={status} />
                </span>
                <span className="mr-lab-card__date-row">
                  <MrIconCalendarToday size={13} />
                  <span className="mr-lab-card__date">{date}</span>
                  {slot ? <span className="mr-lab-card__slot">{`  •  ${slot}`}</span> : null}
                </span>
                <span className="mr-lab-card__badges">
                  <VisitTypeBadge homePickup={home} />
                  {sponsored ? <span className="mr-lab-sponsored">Sponsored</span> : null}
                </span>
              </span>
              <span className="mr-lab-card__chevron" aria-hidden>
                <MrIconChevronRight />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
