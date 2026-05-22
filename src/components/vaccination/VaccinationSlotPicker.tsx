import { useEffect, useMemo, useState } from "react";
import { SlotPeriodIcon } from "@/components/slots/SlotPeriodIcon";
import {
  getVaccinationBookingDays,
  getVaccinationSlotsForDate,
  sameCalendarDay,
  VACCINATION_BOOKING_DAY_COUNT,
  VACCINATION_PERIOD_GROUPS,
  type VaccinationDayStripResult,
} from "@/components/vaccination/vaccinationSlotRules";
import "@/pages/HealthCheckupsPage.css";
import "./VaccinationSlotPicker.css";

export {
  formatPreferredApiDateTime,
  formatVaccineSlotDisplay,
  parsePreferredApiDateTime,
} from "./vaccinationSlotPickerFormat";

export type VaccinationSlotPickerProps = Readonly<{
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
  /** Renders Continue when provided */
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  /** Number of consecutive days in the strip (default 5). */
  bookingDayCount?: number;
  /**
   * When false, the Continue/Apply bar is not rendered (use a page-level `hc-footer` instead).
   */
  showContinueFooter?: boolean;
}>;

export function VaccinationSlotPicker({
  selectedDay,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
  onContinue,
  continueDisabled,
  continueLabel = "Continue",
  bookingDayCount = VACCINATION_BOOKING_DAY_COUNT,
  showContinueFooter = true,
}: VaccinationSlotPickerProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const bookingNow = useMemo(() => new Date(nowTick), [nowTick]);

  const dayStrip: VaccinationDayStripResult = useMemo(
    () => getVaccinationBookingDays(bookingDayCount, bookingNow),
    [bookingDayCount, bookingNow],
  );

  const slotsByPeriod = useMemo(
    () => getVaccinationSlotsForDate(selectedDay, bookingNow),
    [selectedDay, bookingNow],
  );

  const flatAvailable = useMemo(
    () => VACCINATION_PERIOD_GROUPS.flatMap((g) => slotsByPeriod[g.key].map((r) => r.time)),
    [slotsByPeriod],
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
        <span className="vac-slot-pick__month">{dayStrip.monthYearLabel}</span>
      </div>

      <div className="vac-slot-pick__dates" role="list">
        {dayStrip.dates.map((d, index) => {
          const sel = sameCalendarDay(d, selectedDay);
          const chip = dayStrip.availableDates[index];
          const key = dayStrip.calendarDateStrings[index] ?? formatYmdLocal(d);
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              className={`vac-slot-pick__date${sel ? " vac-slot-pick__date--selected" : ""}`}
              onClick={() => handleSelectDay(d)}
            >
              <span className="vac-slot-pick__date-num">{chip?.day ?? d.getDate()}</span>
              <span className="vac-slot-pick__date-dow">{chip?.weekday ?? ""}</span>
            </button>
          );
        })}
      </div>

      {VACCINATION_PERIOD_GROUPS.map((g) => {
        const rows = slotsByPeriod[g.key];
        if (rows.length === 0) return null;
        return (
          <section key={g.id} className="vac-slot-pick__group">
            <div className="vac-slot-pick__group-head">
              <SlotPeriodIcon period={g.id} />
              {g.label}
            </div>
            <div className="vac-slot-pick__pills">
              {rows.map((row) => {
                const on = selectedSlot === row.time;
                return (
                  <button
                    key={row.time24}
                    type="button"
                    className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}`}
                    disabled={row.isDisabled}
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
          No slots for this day. Please check an upcoming day or try the next day.
        </p>
      ) : null}

      {onContinue && showContinueFooter ? (
        <footer className="hc-footer vac-slot-pick__footer">
          <button
            type="button"
            className="bottom-continue"
            disabled={flatAvailable.length === 0 || (continueDisabled ?? !selectedSlot)}
            onClick={onContinue}
          >
            {continueLabel}
          </button>
        </footer>
      ) : null}
    </div>
  );
}

function formatYmdLocal(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mo}-${da}`;
}
