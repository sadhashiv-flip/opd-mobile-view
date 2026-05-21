import { useEffect, useMemo, useState } from "react";
import { SlotPeriodIcon } from "@/components/slots/SlotPeriodIcon";
import {
  getDentalSlotsForDate,
  sameCalendarDay,
  type DentalSlotRow,
} from "@/utils/dentalSlotRules";
import "@/pages/HealthCheckupsPage.css";
import "@/components/vaccination/VaccinationSlotPicker.css";

const GROUPS = [
  { id: "morning" as const, label: "Morning", pick: (b: ReturnType<typeof getDentalSlotsForDate>) => b.morningSlots },
  { id: "afternoon" as const, label: "Afternoon", pick: (b: ReturnType<typeof getDentalSlotsForDate>) => b.afternoonSlots },
  { id: "evening" as const, label: "Evening", pick: (b: ReturnType<typeof getDentalSlotsForDate>) => b.eveningSlots },
] as const;

export type DentalSlotPickerProps = Readonly<{
  bookingDates: readonly Date[];
  /** From `getDentalBookingDays().monthYearLabel` (first day of strip). */
  monthYearLabel: string;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
  /** Recompute slot buckets when “now” advances (mirrors `getSlotsForDate` using current time). */
  bookingNow?: Date;
}>;

export function DentalSlotPicker({
  bookingDates,
  monthYearLabel,
  selectedDay,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
  bookingNow: bookingNowProp,
}: DentalSlotPickerProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const bookingNow = useMemo(
    () => bookingNowProp ?? new Date(nowTick),
    [bookingNowProp, nowTick],
  );

  const buckets = useMemo(
    () => getDentalSlotsForDate(selectedDay, bookingNow),
    [selectedDay, bookingNow],
  );

  const flatAvailable = useMemo(
    () => GROUPS.flatMap((g) => g.pick(buckets).map((r: DentalSlotRow) => r.time)),
    [buckets],
  );

  useEffect(() => {
    if (flatAvailable.length === 0) {
      if (selectedSlot !== null) onSelectSlot(null);
      return;
    }
    if (selectedSlot !== null && !flatAvailable.includes(selectedSlot)) {
      onSelectSlot(null);
    }
  }, [selectedDay, selectedSlot, onSelectSlot, flatAvailable]);

  const handleSelectDay = (d: Date) => {
    onSelectDay(d);
    onSelectSlot(null);
  };

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
        {bookingDates.map((d) => {
          const sel = sameCalendarDay(d, selectedDay);
          const num = d.getDate();
          const dow = d.toLocaleDateString("en-IN", { weekday: "short" });
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              className={`vac-slot-pick__date${sel ? " vac-slot-pick__date--selected" : ""}`}
              onClick={() => handleSelectDay(d)}
            >
              <span className="vac-slot-pick__date-num">{num}</span>
              <span className="vac-slot-pick__date-dow">{dow}</span>
            </button>
          );
        })}
      </div>

      {GROUPS.map((g) => {
        const rows = g.pick(buckets);
        if (rows.length === 0) return null;
        return (
          <section key={g.id} className="vac-slot-pick__group">
            <div className="vac-slot-pick__group-head">
              <SlotPeriodIcon period={g.id} />
              {g.label}
            </div>
            <div className="vac-slot-pick__pills">
              {rows.map((row: DentalSlotRow) => {
                const on = selectedSlot === row.time;
                const disabled = row.isDisabled;
                return (
                  <button
                    key={`${g.id}-${row.time24}`}
                    type="button"
                    className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}${disabled ? " vac-slot-pick__pill--disabled" : ""}`}
                    disabled={disabled}
                    onClick={() => onSelectSlot(row.time)}
                  >
                    {row.time}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {flatAvailable.length === 0 ? (
        <p className="vac-slot-pick__empty" role="status">
          No slots available
        </p>
      ) : null}
    </div>
  );
}
