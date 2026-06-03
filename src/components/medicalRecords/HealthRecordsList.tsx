import type { ReactNode } from "react";
import type { MedicalRecordCategoryDef } from "@/constants/medicalRecordsCategories";
import {
  HealthLogConditionIcon,
  HealthLogMeasurementIcon,
} from "@/components/medicalRecords/MedicalRecordsIcons";
import {
  MrClockMeta,
  MrDoseTag,
  MrGradientIcon,
  MrHealthCardShell,
  MrMedicineIcon,
  MrStatusPill,
  MrSymptomIcon,
} from "@/components/medicalRecords/MrRecordParts";
import {
  bmiCategory,
  bmiCategoryColor,
  bmiValue,
  conditionDisplayLabel,
  conditionIsOngoing,
  formatHealthRecordDateTime,
  formatRecordDate,
  measurementDetailNum,
  measurementTypeLabel,
  medicineDose,
  medicineIsChronic,
  medicineName,
  moodAccentColor,
  moodEmoji,
  moodLabel,
  moodValue,
  pickStr,
  symptomIsChronic,
} from "@/lib/medicalRecordRow";
import "./MedicalRecordsCards.css";

export type HealthRecordsListProps = Readonly<{
  category: MedicalRecordCategoryDef;
  rows: readonly Record<string, unknown>[];
  onSymptomOpen?: (row: Record<string, unknown>) => void;
}>;

function MoodDots({ value, color }: Readonly<{ value: number; color: string }>) {
  return (
    <span className="mr-mood-dots" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="mr-mood-dots__dot"
          style={{ background: i <= value ? color : `${color}33` }}
        />
      ))}
    </span>
  );
}

function MedicineCard({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const name = medicineName(row);
  const dose = medicineDose(row);
  const chronic = medicineIsChronic(row);
  const when = formatHealthRecordDateTime(row);
  const gradient = chronic
    ? "linear-gradient(135deg, #d97706 0%, #ffb300 100%)"
    : "linear-gradient(135deg, #26a69a 0%, #80cbc4 100%)";

  return (
    <MrHealthCardShell>
      <MrGradientIcon gradient={gradient}>
        <MrMedicineIcon />
      </MrGradientIcon>
      <span className="mr-health-card__body">
        <span className="mr-health-card__title-row">
          <span className="mr-health-card__title">{name}</span>
          {chronic ? <MrStatusPill label="Chronic" tone="warning" /> : null}
        </span>
        <MrDoseTag dose={dose} />
        <MrClockMeta text={when} />
      </span>
    </MrHealthCardShell>
  );
}

function SymptomCard({
  row,
  onOpen,
}: Readonly<{ row: Record<string, unknown>; onOpen?: () => void }>) {
  const title = pickStr(row.value, row.title) || "Symptom";
  const chronic = symptomIsChronic(row);
  const when = formatHealthRecordDateTime(row);
  const desc = pickStr(row.description);
  const gradient = chronic
    ? "linear-gradient(135deg, #d97706 0%, #ffb300 100%)"
    : "linear-gradient(135deg, #ec407a 0%, #f48fb1 100%)";

  return (
    <MrHealthCardShell onClick={onOpen} className="mr-symptom-card">
      <MrGradientIcon gradient={gradient}>
        <MrSymptomIcon />
      </MrGradientIcon>
      <span className="mr-health-card__body">
        <span className="mr-health-card__title-row">
          <span className="mr-health-card__title">{title}</span>
          <MrStatusPill label={chronic ? "Chronic" : "General"} tone={chronic ? "warning" : "info"} />
        </span>
        <MrClockMeta text={when} />
        {desc ? <span className="mr-health-card__desc">{desc}</span> : null}
      </span>
    </MrHealthCardShell>
  );
}

function MoodCard({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const value = moodValue(row);
  const color = moodAccentColor(value);
  const when = formatHealthRecordDateTime(row);

  return (
    <MrHealthCardShell>
      <span className="mr-mood-emoji" style={{ background: `${color}1f` }} aria-hidden>
        {moodEmoji(value)}
      </span>
      <span className="mr-health-card__body">
        <span className="mr-health-card__title-row">
          <span className="mr-health-card__title" style={{ color }}>
            {moodLabel(value)}
          </span>
          <MoodDots value={value} color={color} />
        </span>
        <MrClockMeta text={when} />
      </span>
    </MrHealthCardShell>
  );
}

function MeasurementCard({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const label = measurementTypeLabel(row);
  const bmi = bmiValue(row);
  const cat = bmiCategory(bmi);
  const catColor = bmiCategoryColor(cat);
  const height = measurementDetailNum(row, "height");
  const weight = measurementDetailNum(row, "weight");
  const when = formatHealthRecordDateTime(row);

  return (
    <MrHealthCardShell>
      <MrGradientIcon gradient="linear-gradient(135deg, #5c6bc0 0%, #9fa8da 100%)">
        <HealthLogMeasurementIcon />
      </MrGradientIcon>
      <span className="mr-health-card__body">
        <span className="mr-health-card__title-row">
          <span className="mr-health-card__title">{label}</span>
          {cat ? (
            <span className="mr-status-pill" style={{ color: catColor, background: `${catColor}1a` }}>
              {cat}
            </span>
          ) : null}
        </span>
        <span className="mr-metric-chips">
          {height != null ? <span className="mr-metric-chip">{(height).toFixed(1)} cm</span> : null}
          {weight != null ? <span className="mr-metric-chip mr-metric-chip--primary">{(weight).toFixed(1)} kg</span> : null}
          {bmi != null ? (
            <span className="mr-metric-chip" style={{ color: catColor, background: `${catColor}14` }}>
              BMI {bmi.toFixed(1)}
            </span>
          ) : null}
        </span>
        <MrClockMeta text={when} />
      </span>
    </MrHealthCardShell>
  );
}

function ConditionCard({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const label = conditionDisplayLabel(row);
  const ongoing = conditionIsOngoing(row);
  const sinceRaw = pickStr(row.since);
  const endedRaw = pickStr(row.ended);
  const since = formatRecordDate(sinceRaw);
  const ended = formatRecordDate(endedRaw);
  const gradient = ongoing
    ? "linear-gradient(135deg, #dc2626 0%, #ef5350 100%)"
    : "linear-gradient(135deg, #16a34a 0%, #66bb6a 100%)";

  return (
    <MrHealthCardShell>
      <MrGradientIcon gradient={gradient}>
        <HealthLogConditionIcon />
      </MrGradientIcon>
      <span className="mr-health-card__body">
        <span className="mr-health-card__title-row">
          <span className="mr-health-card__title">{label}</span>
          <MrStatusPill label={ongoing ? "Ongoing" : "Resolved"} tone={ongoing ? "error" : "success"} />
        </span>
        {since ? <span className="mr-health-card__desc">Since {since}</span> : null}
        {!ongoing && ended ? <span className="mr-health-card__desc">Ended {ended}</span> : null}
      </span>
    </MrHealthCardShell>
  );
}

function WomensCard({ row }: Readonly<{ row: Record<string, unknown> }>) {
  return <SymptomCard row={row} />;
}

export function HealthRecordsList({ category, rows, onSymptomOpen }: HealthRecordsListProps) {
  return (
    <ul className="mr-records-list">
      {rows.map((row, i) => {
        const key = pickStr(row.id) || `health-${i}`;
        let card: ReactNode;
        switch (category.slug) {
          case "medicines":
            card = <MedicineCard row={row} />;
            break;
          case "symptoms":
            card = (
              <SymptomCard
                row={row}
                onOpen={onSymptomOpen ? () => onSymptomOpen(row) : undefined}
              />
            );
            break;
          case "moods":
            card = <MoodCard row={row} />;
            break;
          case "measurements":
            card = <MeasurementCard row={row} />;
            break;
          case "conditions":
            card = <ConditionCard row={row} />;
            break;
          case "womens":
            card = <WomensCard row={row} />;
            break;
          default:
            card = <SymptomCard row={row} />;
        }
        return <li key={key}>{card}</li>;
      })}
    </ul>
  );
}
