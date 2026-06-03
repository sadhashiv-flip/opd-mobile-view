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

function VitalTypeIcon({ type }: Readonly<{ type: string }>) {
  const stroke = "#fff";
  switch (type.toUpperCase()) {
    case "HR":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 21.35l-1.45-1.32C7.4 14.36 4 11.28 4 8.5 4 6 6 4 9.5 4c1.2 0 2.4.6 3 1.5C13.1 4.6 14.3 4 15.5 4 19 4 21 6 21 8.5c0 2.78-3.4 5.86-7.55 10.54L12 21.35z"
            fill={stroke}
          />
        </svg>
      );
    case "O2":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9.5 12c1.5-2.5 4-4 6.5-4 2.5 0 4.5 2 4.5 4.5S18.5 17 16 17c-2.5 0-5-1.5-6.5-4zM4 12c1.5-2.5 4-4 6.5-4"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "TEMP":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M14 14.76V5a2 2 0 00-4 0v9.76a4 4 0 104 0z"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "BP":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v18M8 8h8M7 12h10M6 16h12"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "RR":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 12c2-4 5-6 10-6s8 2 10 6M2 16c2 4 5 6 10 6s8-2 10-6"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "SUGAR":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v4M8 7h8M7 11h10l-2 10H9L7 11z"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 12h3l2-6 4 12 2-6h3"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

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
