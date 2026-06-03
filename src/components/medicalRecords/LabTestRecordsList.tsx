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

function LabIcon({ category }: Readonly<{ category: string }>) {
  const radiology = category.toLowerCase() === "radiology";
  return radiology ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h3l2-6 4 12 2-6h3M12 16v5M9 19h6"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h12l-1 4 2 4-1 4H7l-1-4 2-4-1-4zM10 16v4M14 16v4"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
      {homePickup ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-9.5z"
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
                <LabIcon category={category} />
              </span>
              <span className="mr-lab-card__body">
                <span className="mr-lab-card__title-row">
                  <span className="mr-lab-card__title">{title}</span>
                  <LabStatusChip label={status} />
                </span>
                <span className="mr-lab-card__date-row">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M8 2v3M16 2v3M4 9h16M6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="mr-lab-card__date">{date}</span>
                  {slot ? <span className="mr-lab-card__slot">{`  •  ${slot}`}</span> : null}
                </span>
                <span className="mr-lab-card__badges">
                  <VisitTypeBadge homePickup={home} />
                  {sponsored ? <span className="mr-lab-sponsored">Sponsored</span> : null}
                </span>
              </span>
              <span className="mr-lab-card__chevron" aria-hidden>
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
