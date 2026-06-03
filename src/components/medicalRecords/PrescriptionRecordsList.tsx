import {
  MrIconCalendarToday,
  MrIconChevronRight,
  MrIconMedicationLiquid,
  PrescriptionCardIcon,
} from "@/components/medicalRecords/MedicalRecordsIcons";
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
      <PrescriptionCardIcon />
    </span>
  );
}

function MedicineCountBadge({ count }: Readonly<{ count: number }>) {
  if (count <= 0) return null;
  return (
    <span className="mr-rx-count-badge">
      <MrIconMedicationLiquid size={11} />
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
                    <MrIconCalendarToday size={13} />
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
                <MrIconChevronRight />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
