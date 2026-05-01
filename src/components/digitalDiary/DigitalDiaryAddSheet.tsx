import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import {
  activityLogTitleForApiType,
  activitySubmitPayloads,
  DIARY_MOOD_LABELS,
  type DigitalDiaryActivityType,
} from "@/lib/digitalDiary";
import "./DigitalDiaryAddSheet.css";

export type DigitalDiaryAddSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  apiType: DigitalDiaryActivityType;
  isSubmitting: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}>;

export function DigitalDiaryAddSheet({
  open,
  onClose,
  apiType,
  isSubmitting,
  onSubmit,
}: DigitalDiaryAddSheetProps) {
  const [single, setSingle] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [symptom, setSymptom] = useState("");
  const [workoutCal, setWorkoutCal] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [sleepH, setSleepH] = useState("");
  const [sleepM, setSleepM] = useState("");
  const [waterGlasses, setWaterGlasses] = useState(1);
  const [moodIndex, setMoodIndex] = useState<number | null>(null);

  if (!open) return null;

  const title = `Add ${activityLogTitleForApiType(apiType)}`;

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    let body: Record<string, unknown> | null = null;
    const t = apiType;

    switch (t) {
      case "GL":
      case "TEMP":
      case "O2":
      case "HR": {
        const v = single.trim();
        if (!v) return;
        body = activitySubmitPayloads.parameter(t, v);
        break;
      }
      case "BP": {
        const s = systolic.trim();
        const d = diastolic.trim();
        if (!s || !d) return;
        body = activitySubmitPayloads.parameter("BP", `${s}/${d}`);
        break;
      }
      case "water": {
        if (waterGlasses < 1) return;
        body = activitySubmitPayloads.water(waterGlasses);
        break;
      }
      case "mood": {
        if (moodIndex == null) return;
        body = activitySubmitPayloads.mood(moodIndex);
        break;
      }
      case "medicine": {
        const n = medName.trim();
        const dose = medDose.trim();
        if (!n || !dose) return;
        body = activitySubmitPayloads.medicine(n, dose);
        break;
      }
      case "symptom": {
        const s = symptom.trim();
        if (!s) return;
        body = activitySubmitPayloads.symptom(s);
        break;
      }
      case "sleep": {
        const h = Number.parseInt(sleepH.trim(), 10) || 0;
        const m = Number.parseInt(sleepM.trim(), 10) || 0;
        if (h <= 0 && m <= 0) return;
        const mm = Math.min(Math.max(m, 0), 59);
        const hm = `${h}:${String(mm).padStart(2, "0")}`;
        body = activitySubmitPayloads.sleep(hm);
        break;
      }
      case "workout": {
        const c = workoutCal.trim();
        if (!c) return;
        body = activitySubmitPayloads.workoutCalories(c);
        break;
      }
      case "height":
      case "weight": {
        const ft = Number.parseInt(feet.trim(), 10);
        const inch = Number.parseInt(inches.trim(), 10);
        const w = weightKg.trim();
        if (
          Number.isNaN(ft) ||
          Number.isNaN(inch) ||
          !w ||
          inch < 0 ||
          inch > 11
        ) {
          return;
        }
        const heightStr = `${ft}.${String(inch).padStart(2, "0")}`;
        body = activitySubmitPayloads.bmi(heightStr, w);
        break;
      }
      default:
        return;
    }

    const ok = await onSubmit(body);
    if (ok) onClose();
  }

  function formInner() {
    switch (apiType) {
      case "GL":
        return (
          <label className="dd-sheet__field">
            <span>Glucose (mg/dL)</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={single}
              onChange={(e) =>
                setSingle(e.target.value.replace(/\D/g, "").slice(0, 16))
              }
            />
          </label>
        );
      case "TEMP":
        return (
          <label className="dd-sheet__field">
            <span>Temperature (°F)</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={single}
              onChange={(e) =>
                setSingle(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
              }
            />
          </label>
        );
      case "O2":
        return (
          <label className="dd-sheet__field">
            <span>SpO₂ (%)</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={single}
              onChange={(e) =>
                setSingle(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
            />
          </label>
        );
      case "HR":
        return (
          <label className="dd-sheet__field">
            <span>Heart rate (bpm)</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={single}
              onChange={(e) =>
                setSingle(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </label>
        );
      case "BP":
        return (
          <>
            <label className="dd-sheet__field">
              <span>Systolic (mmHg)</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={systolic}
                onChange={(e) =>
                  setSystolic(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </label>
            <label className="dd-sheet__field">
              <span>Diastolic (mmHg)</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={diastolic}
                onChange={(e) =>
                  setDiastolic(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </label>
          </>
        );
      case "water":
        return (
          <div className="dd-sheet__water">
            <button
              type="button"
              className="dd-sheet__water-btn"
              aria-label="Decrease glasses"
              disabled={waterGlasses <= 0}
              onClick={() =>
                setWaterGlasses((g) => (g > 0 ? g - 1 : 0))
              }
            >
              −
            </button>
            <div className="dd-sheet__water-mid">
              <span className="dd-sheet__water-num">{waterGlasses}</span>
              <span className="dd-sheet__water-label">glasses</span>
            </div>
            <button
              type="button"
              className="dd-sheet__water-btn"
              aria-label="Increase glasses"
              onClick={() =>
                setWaterGlasses((g) => (g < 50 ? g + 1 : g))
              }
            >
              +
            </button>
          </div>
        );
      case "mood":
        return (
          <div className="dd-sheet__moods" role="group" aria-label="Mood">
            {[1, 2, 3, 4, 5].map((idx) => (
              <button
                key={idx}
                type="button"
                className={`dd-sheet__mood-chip${moodIndex === idx ? " dd-sheet__mood-chip--on" : ""}`}
                onClick={() => setMoodIndex(idx)}
              >
                {DIARY_MOOD_LABELS[idx]}
              </button>
            ))}
          </div>
        );
      case "medicine":
        return (
          <>
            <label className="dd-sheet__field">
              <span>Medicine name</span>
              <input
                type="text"
                autoCapitalize="words"
                autoComplete="off"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
              />
            </label>
            <label className="dd-sheet__field">
              <span>Dosage</span>
              <input
                type="text"
                autoComplete="off"
                value={medDose}
                onChange={(e) => setMedDose(e.target.value)}
              />
            </label>
          </>
        );
      case "symptom":
        return (
          <label className="dd-sheet__field">
            <span>Symptoms</span>
            <textarea
              rows={3}
              autoCapitalize="sentences"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
            />
          </label>
        );
      case "sleep":
        return (
          <div className="dd-sheet__row2">
            <label className="dd-sheet__field">
              <span>Hours</span>
              <input
                type="text"
                inputMode="numeric"
                value={sleepH}
                onChange={(e) =>
                  setSleepH(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
              />
            </label>
            <label className="dd-sheet__field">
              <span>Minutes</span>
              <input
                type="text"
                inputMode="numeric"
                value={sleepM}
                onChange={(e) =>
                  setSleepM(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
              />
            </label>
          </div>
        );
      case "workout":
        return (
          <label className="dd-sheet__field">
            <span>Calories burned</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 120"
              value={workoutCal}
              onChange={(e) =>
                setWorkoutCal(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
            />
          </label>
        );
      case "height":
      case "weight":
        return (
          <>
            <p className="dd-sheet__hint">Height & weight (BMI log)</p>
            <div className="dd-sheet__row2">
              <label className="dd-sheet__field">
                <span>Feet</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={feet}
                  onChange={(e) =>
                    setFeet(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                />
              </label>
              <label className="dd-sheet__field">
                <span>Inches (0–11)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inches}
                  onChange={(e) =>
                    setInches(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                />
              </label>
            </div>
            <label className="dd-sheet__field">
              <span>Weight (kg)</span>
              <input
                type="text"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) =>
                  setWeightKg(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))
                }
              />
            </label>
          </>
        );
      default:
        return (
          <p className="dd-sheet__hint">
            Adding entries for this type is not available yet.
          </p>
        );
    }
  }

  return createPortal(
    <dialog
      className="dd-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="dd-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form className="dd-sheet" onSubmit={handleSave}>
        <div className="dd-sheet__grab" aria-hidden />
        <h2 id="dd-sheet-title" className="dd-sheet__title">
          {title}
        </h2>
        <div className="dd-sheet__body">{formInner()}</div>
        <button
          type="submit"
          className="dd-sheet__save"
          disabled={isSubmitting}
        >
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
