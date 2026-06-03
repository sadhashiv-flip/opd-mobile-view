import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MdClose } from "react-icons/md";
import { MrIconAccessTime } from "@/components/medicalRecords/MedicalRecordsIcons";
import { MrStatusPill } from "@/components/medicalRecords/MrRecordParts";
import { formatHealthRecordDateTime, pickStr, symptomIsChronic } from "@/lib/medicalRecordRow";
import "./SymptomDetailSheet.css";

export type SymptomDetailSheetProps = Readonly<{
  open: boolean;
  row: Record<string, unknown> | null;
  onClose: () => void;
}>;

/** Matches Flutter `symptom_detail_sheet.dart`. */
export function SymptomDetailSheet({ open, row, onClose }: SymptomDetailSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !row) return null;

  const title = pickStr(row.value, row.title) || "Symptom";
  const description = pickStr(row.description);
  const when = formatHealthRecordDateTime(row);
  const chronic = symptomIsChronic(row);

  const sheet = (
    <div
      className="mr-symptom-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="mr-symptom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mr-symptom-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mr-symptom-sheet__handle" aria-hidden />

        <header className="mr-symptom-sheet__header">
          <h2 id="mr-symptom-sheet-title" className="mr-symptom-sheet__title">
            Symptom Details
          </h2>
          <div className="mr-symptom-sheet__header-actions">
            <MrStatusPill label={chronic ? "Chronic" : "General"} tone={chronic ? "warning" : "info"} />
            <button
              type="button"
              className="mr-symptom-sheet__close"
              aria-label="Close"
              onClick={onClose}
            >
              <MdClose size={24} aria-hidden />
            </button>
          </div>
        </header>

        <div className="mr-symptom-sheet__body">
          <div className="mr-symptom-detail__card">
            <span className="mr-symptom-detail__card-label">Symptom</span>
            <p className="mr-symptom-detail__card-value">{title}</p>
          </div>

          {when ? (
            <div className="mr-symptom-detail__card mr-symptom-detail__card--time">
              <span className="mr-symptom-detail__time-icon" aria-hidden>
                <MrIconAccessTime size={20} color="var(--color-primary, #ff5224)" />
              </span>
              <div className="mr-symptom-detail__time-text">
                <span className="mr-symptom-detail__card-label">Logged Date &amp; Time</span>
                <p className="mr-symptom-detail__card-value">{when}</p>
              </div>
            </div>
          ) : null}

          {description ? (
            <div className="mr-symptom-detail__card">
              <span className="mr-symptom-detail__card-label">Notes / Description</span>
              <p className="mr-symptom-detail__card-value mr-symptom-detail__card-value--justify">
                {description}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
