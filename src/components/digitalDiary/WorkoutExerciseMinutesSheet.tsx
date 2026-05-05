import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import "./DigitalDiaryAddSheet.css";

export type WorkoutExerciseMinutesSheetProps = Readonly<{
  open: boolean;
  exerciseName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (minutes: string) => Promise<boolean>;
}>;

export function WorkoutExerciseMinutesSheet({
  open,
  exerciseName,
  isSubmitting,
  onClose,
  onSubmit,
}: WorkoutExerciseMinutesSheetProps) {
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    if (!open) setMinutes("");
  }, [open]);

  if (!open) return null;

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    const m = minutes.trim();
    if (!m || !/^[1-9][0-9]*$/.test(m)) return;
    const ok = await onSubmit(m);
    if (ok) {
      setMinutes("");
      onClose();
    }
  }

  return createPortal(
    <dialog
      className="dd-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="dd-workout-min-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form className="dd-sheet" onSubmit={handleSave}>
        <div className="dd-sheet__grab" aria-hidden />
        <h2 id="dd-workout-min-title" className="dd-sheet__title">
          {DIGITAL_DIARY_COPY.workoutMinutesTitle}
        </h2>
        <p className="dd-sheet__hint">{exerciseName}</p>
        <div className="dd-sheet__body">
          <label className="dd-sheet__field">
            <span>{DIGITAL_DIARY_COPY.workoutMinutesLabel}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="e.g. 30"
              value={minutes}
              onChange={(e) =>
                setMinutes(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
            />
          </label>
        </div>
        <button type="submit" className="dd-sheet__save" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="dd-sheet__spinner" aria-hidden />
          ) : (
            <span>{DIGITAL_DIARY_COPY.sheetSave}</span>
          )}
        </button>
      </form>
    </dialog>,
    document.body,
  );
}
