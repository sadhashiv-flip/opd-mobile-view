import { useEffect, useMemo, useState } from "react";
import {
  getDentalSlotsForDate,
  sameCalendarDay,
  type DentalSlotRow,
} from "@/utils/dentalSlotRules";
import "@/pages/HealthCheckupsPage.css";
import "@/components/vaccination/VaccinationSlotPicker.css";

const GROUPS = [
  { id: "morning", label: "Morning", pick: (b: ReturnType<typeof getDentalSlotsForDate>) => b.morningSlots },
  { id: "afternoon", label: "Afternoon", pick: (b: ReturnType<typeof getDentalSlotsForDate>) => b.afternoonSlots },
  { id: "evening", label: "Evening", pick: (b: ReturnType<typeof getDentalSlotsForDate>) => b.eveningSlots },
] as const;

function PeriodIcon({ period }: Readonly<{ period: "morning" | "afternoon" | "evening" }>) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const, "aria-hidden": true };
  if (period === "morning") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path
          d="M12 2v2M12 20v2M2 12h2M20 12h2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (period === "afternoon") {
    return (
      <svg {...common}>
        <path d="M4 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="10" r="3.5" fill="currentColor" />
        <path
          d="M8 6c1.5-1 3.5-1 5 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 10c1.5 1 3.5 1 5 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

export type DentalSlotPickerProps = Readonly<{
  bookingDates: readonly Date[];
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
}>;

export function DentalSlotPicker({
  bookingDates,
  selectedDay,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
}: DentalSlotPickerProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const bookingNow = useMemo(() => new Date(nowTick), [nowTick]);

  const monthLabel = selectedDay.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  const buckets = useMemo(() => getDentalSlotsForDate(selectedDay, bookingNow), [selectedDay, bookingNow]);

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
        <span className="vac-slot-pick__month">{monthLabel}</span>
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
              onClick={() => onSelectDay(d)}
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
              <span className="vac-slot-pick__sun" aria-hidden>
                <PeriodIcon period={g.id} />
              </span>
              {g.label}
            </div>
            <div className="vac-slot-pick__pills">
              {rows.map((row: DentalSlotRow) => {
                const on = selectedSlot === row.time;
                return (
                  <button
                    key={`${g.id}-${row.time24}`}
                    type="button"
                    className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}`}
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
          No slots left for this day. Pick another date.
        </p>
      ) : null}
    </div>
  );
}
