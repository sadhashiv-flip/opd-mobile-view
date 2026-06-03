import { MobileFilterSheet } from "@/components/mobileFilter/MobileFilterSheet";
import { healthRecordDatetime, pickStr, symptomIsChronic } from "@/lib/medicalRecordRow";
import "./MedicalRecordsCards.css";

export type SymptomDetailSheetProps = Readonly<{
  open: boolean;
  row: Record<string, unknown> | null;
  onClose: () => void;
}>;

export function SymptomDetailSheet({ open, row, onClose }: SymptomDetailSheetProps) {
  if (!row) return null;

  const title = pickStr(row.title, row.value) || "Symptom";
  const description = pickStr(row.description);
  const when = healthRecordDatetime(row);
  const chronic = symptomIsChronic(row);

  return (
    <MobileFilterSheet
      open={open}
      onClose={onClose}
      title="Symptom details"
      subtitle={chronic ? "Chronic symptom" : "General symptom"}
    >
      <div className="mobile-filter-sheet__divider" />
      <div className="mobile-filter-sheet__section" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span
          className={`mr-symptom-detail__badge${chronic ? " mr-symptom-detail__badge--chronic" : " mr-symptom-detail__badge--acute"}`}
          style={{ alignSelf: "flex-start" }}
        >
          {chronic ? "Chronic" : "General"}
        </span>
        <div className="mr-symptom-detail__card">
          <span className="mr-symptom-detail__card-label">Symptom</span>
          <p className="mr-symptom-detail__card-value">{title}</p>
        </div>
        {when ? (
          <div className="mr-symptom-detail__card">
            <span className="mr-symptom-detail__card-label">Logged date &amp; time</span>
            <p className="mr-symptom-detail__card-value">{when}</p>
          </div>
        ) : null}
        {description ? (
          <div className="mr-symptom-detail__card">
            <span className="mr-symptom-detail__card-label">Notes / description</span>
            <p className="mr-symptom-detail__card-value">{description}</p>
          </div>
        ) : null}
        {!description && !when ? (
          <p className="mr-status">No additional details for this entry.</p>
        ) : null}
      </div>
      <button type="button" className="mr-filter-done" onClick={onClose}>
        Done
      </button>
    </MobileFilterSheet>
  );
}
