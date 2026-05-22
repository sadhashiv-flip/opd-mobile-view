import { useEffect, useMemo } from "react";
import { SlotPeriodIcon } from "@/components/slots/SlotPeriodIcon";
import { VISION_NO_SLOTS_AVAILABLE_COPY, type VisionServiceSlotsData } from "@/api/visionServiceSlots";
import { visionSlotsAllEmpty } from "@/lib/visionSlotSelection";
import "@/pages/HealthCheckupsPage.css";
import "@/components/vaccination/VaccinationSlotPicker.css";

const GROUPS = [
  { id: "morning" as const, label: "Morning", key: "morning" as const },
  { id: "afternoon" as const, label: "Afternoon", key: "afternoon" as const },
  { id: "evening" as const, label: "Evening", key: "evening" as const },
] as const;

export type VisionSlotPickerProps = Readonly<{
  daysList: readonly string[];
  slots: VisionServiceSlotsData["slots"];
  /** From `daysList[0]` — patient_app `monthYearLabel` (not the tapped date). */
  monthYearLabel: string;
  selectedIsoDate: string;
  onSelectIsoDate: (iso: string) => void;
  selectedSlotId: string | null;
  onSelectSlotId: (id: string | null) => void;
  /** When true, parent replaces UI with full-screen loader (Flutter `isLoading`). */
  hideForLoading?: boolean;
}>;

/**
 * Date + time UI aligned with patient_app `CommonSlotSelector` on vision slot screens.
 * Slot arrays are shown as returned by the API (no client-side date filter).
 */
export function VisionSlotPicker({
  daysList,
  slots,
  monthYearLabel,
  selectedIsoDate,
  onSelectIsoDate,
  selectedSlotId,
  onSelectSlotId,
  hideForLoading = false,
}: VisionSlotPickerProps) {
  const flatSlots = useMemo(
    () => [...slots.morning, ...slots.afternoon, ...slots.evening],
    [slots],
  );

  const allPeriodsEmpty = daysList.length > 0 && visionSlotsAllEmpty(slots);

  useEffect(() => {
    if (flatSlots.length === 0) {
      if (selectedSlotId !== null) onSelectSlotId(null);
      return;
    }
    if (selectedSlotId != null && !flatSlots.some((r) => r.slot_id === selectedSlotId)) {
      onSelectSlotId(null);
    }
  }, [flatSlots, selectedSlotId, onSelectSlotId]);

  if (hideForLoading) {
    return null;
  }

  return (
    <div className="vac-slot-pick">
      <div className="vac-slot-pick__row-label">
        <span className="vac-slot-pick__label">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
            <path
              d="M12 7v6l4 2"
              stroke="#FF541E"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Choose date and time
        </span>
        <span className="vac-slot-pick__month">{monthYearLabel}</span>
      </div>

      <div className="vac-slot-pick__dates" role="list">
        {daysList.map((iso) => {
          const d = new Date(`${iso}T12:00:00`);
          const sel = iso === selectedIsoDate;
          const num = Number.isNaN(d.getTime()) ? "—" : d.getDate();
          const dow = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { weekday: "short" });
          return (
            <button
              key={iso}
              type="button"
              role="listitem"
              className={`vac-slot-pick__date${sel ? " vac-slot-pick__date--selected" : ""}`}
              onClick={() => onSelectIsoDate(iso)}
            >
              <span className="vac-slot-pick__date-num">{num}</span>
              <span className="vac-slot-pick__date-dow">{dow}</span>
            </button>
          );
        })}
      </div>

      {GROUPS.map((g) => {
        const rows = slots[g.key];
        if (rows.length === 0) return null;
        return (
          <section key={g.id} className="vac-slot-pick__group">
            <div className="vac-slot-pick__group-head">
              <SlotPeriodIcon period={g.id} />
              {g.label}
            </div>
            <div className="vac-slot-pick__pills">
              {rows.map((row) => {
                const on = selectedSlotId === row.slot_id;
                return (
                  <button
                    key={row.slot_id}
                    type="button"
                    className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}`}
                    onClick={() => onSelectSlotId(row.slot_id)}
                  >
                    {row.start_time}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {allPeriodsEmpty ? (
        <p className="vac-slot-pick__empty" role="status">
          {VISION_NO_SLOTS_AVAILABLE_COPY}
        </p>
      ) : null}
    </div>
  );
}
