import { VitalTypeIcon } from "@/components/medicalRecords/MedicalRecordsIcons";
import { MrClockMeta } from "@/components/medicalRecords/MrRecordParts";
import {
  formatHealthRecordDateTime,
  healthRecordSource,
  healthRecordValue,
  pickStr,
  vitalAccentColor,
  vitalIconGradient,
  vitalTypeLabel,
} from "@/lib/medicalRecordRow";
import "./MedicalRecordsCards.css";

export type VitalRecordsListProps = Readonly<{
  rows: readonly Record<string, unknown>[];
}>;

export function VitalRecordsList({ rows }: VitalRecordsListProps) {
  return (
    <ul className="mr-records-list">
      {rows.map((row, i) => {
        const key = pickStr(row.id) || `vital-${i}`;
        const type = pickStr(row.type);
        const label = vitalTypeLabel(type);
        const value = healthRecordValue(row);
        const when = formatHealthRecordDateTime(row);
        const source = healthRecordSource(row);
        const accent = vitalAccentColor(type);

        return (
          <li key={key}>
            <div className="mr-vital-card">
              <span
                className="mr-record-card__icon mr-record-card__icon--gradient"
                style={{ background: vitalIconGradient(type) }}
                aria-hidden
              >
                <VitalTypeIcon type={type} />
              </span>
              <span className="mr-vital-card__body">
                <span className="mr-vital-card__title-row">
                  <span className="mr-record-card__title">{label}</span>
                  <span className="mr-vital-card__value-pill" style={{ color: accent, background: `${accent}1a` }}>
                    {value}
                  </span>
                </span>
                {when ? <MrClockMeta text={when} /> : null}
                {source ? <span className="mr-vital-card__source">Source: {source}</span> : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
