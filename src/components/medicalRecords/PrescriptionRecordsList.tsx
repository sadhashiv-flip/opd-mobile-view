import {
  prescriptionCreatedAtDate,
  prescriptionDoctorDisplayName,
  prescriptionDoctorSpecialty,
  prescriptionFirstMedicineName,
  prescriptionIsChronic,
  prescriptionMedicineCount,
} from "@/lib/prescriptionRecordRow";
import { pickStr } from "@/lib/medicalRecordRow";
import "./PrescriptionRecordsList.css";

export type PrescriptionRecordsListProps = Readonly<{
  rows: readonly Record<string, unknown>[];
  onOpen: (row: Record<string, unknown>) => void;
}>;

function PrescriptionIcon({ chronic }: Readonly<{ chronic: boolean }>) {
  const gradient = chronic
    ? "linear-gradient(135deg, #d97706 0%, #ffb300 100%)"
    : "linear-gradient(135deg, #26a69a 0%, #80cbc4 100%)";
  return (
    <span className="mr-rx-card__icon" style={{ background: gradient }} aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 4h8a2 2 0 012 2v1.5a3.5 3.5 0 01-7 0V6a2 2 0 012-2zM7 10.5a5 5 0 0010 0V20a1 1 0 01-1 1H8a1 1 0 01-1-1v-9.5z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

function MedicineCountBadge({ count }: Readonly<{ count: number }>) {
  if (count <= 0) return null;
  return (
    <span className="mr-rx-count-badge">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 4h12l-1 4 2 4-1 4H7l-1-4 2-4-1-4z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      {count} {count === 1 ? "medicine" : "medicines"}
    </span>
  );
}

export function PrescriptionRecordsList({ rows, onOpen }: PrescriptionRecordsListProps) {
  return (
    <ul className="mr-rx-list">
      {rows.map((row, i) => {
        const key = pickStr(row.id) || `rx-${i}`;
        const name = prescriptionDoctorDisplayName(row);
        const spec = prescriptionDoctorSpecialty(row);
        const when = prescriptionCreatedAtDate(row);
        const count = prescriptionMedicineCount(row);
        const chronic = prescriptionIsChronic(row);
        const firstMed = prescriptionFirstMedicineName(row);

        return (
          <li key={key}>
            <button type="button" className="mr-rx-card" onClick={() => onOpen(row)}>
              <PrescriptionIcon chronic={chronic} />
              <span className="mr-rx-card__body">
                <span className="mr-rx-card__name">{name}</span>
                {spec ? <span className="mr-rx-card__spec">{spec}</span> : null}
                {when ? (
                  <span className="mr-rx-card__date-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M8 2v3M16 2v3M4 9h16M6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>{when}</span>
                  </span>
                ) : null}
                <span className="mr-rx-card__footer-row">
                  <MedicineCountBadge count={count} />
                  {chronic ? <span className="mr-rx-chronic-badge">Chronic</span> : null}
                  {firstMed ? <span className="mr-rx-card__first-med">{firstMed}</span> : null}
                </span>
              </span>
              <span className="mr-rx-card__chevron" aria-hidden>
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
