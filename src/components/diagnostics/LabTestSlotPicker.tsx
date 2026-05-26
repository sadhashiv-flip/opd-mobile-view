import { SlotPeriodSectionHead } from "@/components/slots/SlotPeriodIcon";
import type { DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { formatDiagnosticSlotPickLabels } from "@/api/patientDiagnosticsLab";

export type LabDayChip = Readonly<{ day: string; date: string; dow: string }>;

export function labSlotKey(p: DiagnosticSlotPick): string {
  return `${p.slot_id}|${p.slot_date}|${p.start_time}|${p.end_time}`;
}

function slotLabel(s: DiagnosticSlotPick): string {
  const { formattedSlotTimeRange } = formatDiagnosticSlotPickLabels(s);
  if (formattedSlotTimeRange) return formattedSlotTimeRange;
  return `${s.start_time} – ${s.end_time}`;
}

type LabTestSlotPickerProps = Readonly<{
  monthBanner: string;
  days: readonly LabDayChip[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  morning: readonly DiagnosticSlotPick[];
  afternoon: readonly DiagnosticSlotPick[];
  evening: readonly DiagnosticSlotPick[];
  selectedPick: DiagnosticSlotPick | null;
  onSelectSlot: (pick: DiagnosticSlotPick) => void;
  isLoading: boolean;
  /** Set when the app auto-selected a later day because today had no slots. */
  autoAdvancedToDate?: string | null;
}>;

export function LabTestSlotPicker({
  monthBanner,
  days,
  selectedDate,
  onSelectDate,
  morning,
  afternoon,
  evening,
  selectedPick,
  onSelectSlot,
  isLoading,
  autoAdvancedToDate = null,
}: LabTestSlotPickerProps) {
  const allEmpty = morning.length === 0 && afternoon.length === 0 && evening.length === 0;
  const showAutoAdvanceNote =
    autoAdvancedToDate != null && autoAdvancedToDate === selectedDate && !allEmpty;

  const renderPeriod = (
    period: "morning" | "afternoon" | "evening",
    slots: readonly DiagnosticSlotPick[],
    ariaLabel: string,
  ) => {
    if (slots.length === 0) return null;

    return (
      <section className="cas-section cas-section--lab-app" key={period}>
        <SlotPeriodSectionHead period={period} />
        <div className="cas-slots cas-slots--lab-app" role="radiogroup" aria-label={ariaLabel}>
          {slots.map((s) => {
            const active = selectedPick != null && labSlotKey(selectedPick) === labSlotKey(s);
            return (
              <button
                key={labSlotKey(s)}
                type="button"
                className={`cas-slot cas-slot--lab-app${active ? " cas-slot--active" : ""}`}
                role="radio"
                aria-checked={active}
                onClick={() => onSelectSlot(s)}
              >
                {slotLabel(s)}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="cas-lab-picker cas-lab-picker--app">
      <div className="cas-row cas-row--lab-app">
        <div className="cas-row__left">
          <span className="cas-row__ic" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
              <path d="M12 7v6l3 2" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Choose date and time</span>
        </div>
        <div className="cas-row__right">{monthBanner || " "}</div>
      </div>

      <div className="cas-days-wrap cas-days-wrap--lab-app">
        <div className="cas-days cas-days--lab-app" role="radiogroup" aria-label="Choose day">
          {days.map((d) => {
            const active = selectedDate === d.date;
            const autoPick = autoAdvancedToDate === d.date;
            return (
              <button
                key={d.date}
                type="button"
                className={`cas-day cas-day--lab-app${active ? " cas-day--active" : ""}${autoPick ? " cas-day--auto-pick" : ""}`}
                role="radio"
                aria-checked={active}
                onClick={() => onSelectDate(d.date)}
              >
                <div className="cas-day__num">{d.day}</div>
                <div className="cas-day__dow">{d.dow}</div>
              </button>
            );
          })}
        </div>
      </div>

      {showAutoAdvanceNote ? (
        <p className="cas-lab-advance-note" role="status">
          No slots today — showing the next available day.
        </p>
      ) : null}

      {!isLoading && allEmpty && days.length > 0 ? (
        <p className="cas-lab-empty">
          No slots for this day. Please check an upcoming day or try the next day.
        </p>
      ) : null}

      {renderPeriod("morning", morning, "Morning slots")}
      {renderPeriod("afternoon", afternoon, "Afternoon slots")}
      {renderPeriod("evening", evening, "Evening slots")}
    </div>
  );
}
