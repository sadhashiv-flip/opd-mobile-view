import type { AvailableSlot } from "@/api/consultationVirtual";
import { SlotPeriodIcon } from "@/components/slots/SlotPeriodIcon";
import {
  getVirtualBookingDates,
  monthYearIstLabel,
  partitionVirtualSlots,
  sameCalendarDay,
} from "@/utils/consultationVirtualSlotRules";
import { useMemo } from "react";
import "@/components/vaccination/VaccinationSlotPicker.css";

const SLOT_GROUPS = [
  { id: "morning" as const, label: "Morning" },
  { id: "afternoon" as const, label: "Afternoon" },
  { id: "evening" as const, label: "Evening" },
] as const;

export type VirtualConsultationSlotSelectorProps = Readonly<{
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  selectedSlotKey: string;
  onSelectSlotKey: (key: string) => void;
  slots: readonly AvailableSlot[];
  slotsLoading: boolean;
  slotsError: string | null;
  bookingDayCount?: number;
}>;

export function VirtualConsultationSlotSelector({
  selectedDay,
  onSelectDay,
  selectedSlotKey,
  onSelectSlotKey,
  slots,
  slotsLoading,
  slotsError,
  bookingDayCount = 7,
}: VirtualConsultationSlotSelectorProps) {
  const dates = useMemo(() => getVirtualBookingDates(bookingDayCount), [bookingDayCount]);
  const monthLabel = monthYearIstLabel(selectedDay);

  const partitioned = useMemo(() => partitionVirtualSlots(slots), [slots]);

  const allEmpty =
    !slotsLoading &&
    !slotsError &&
    partitioned.morning.length === 0 &&
    partitioned.afternoon.length === 0 &&
    partitioned.evening.length === 0;

  return (
    <div className="vac-slot-pick vcsl-slot-pick">
      <div className="cvsl-note vcsl-note--info" role="note">
        <span className="cvsl-note__ic" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16v-4M12 8h.01"
              stroke="#FF541E"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
          </svg>
        </span>
        <p>
          Check the slots available for the next day if your preferred date is unavailable.
        </p>
      </div>

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

      <div className="vac-slot-pick__dates" role="list" aria-label="Select date">
        {dates.map((d) => {
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

      {slotsLoading ? (
        <div className="vcsl-slots-loading" aria-busy="true">
          <div className="vcsl-slots-loading__spinner" />
          <p>Loading slots…</p>
        </div>
      ) : null}

      {slotsError ? (
        <p className="vac-slot-pick__empty vac-slot-pick__empty--err" role="alert">
          {slotsError}
        </p>
      ) : null}

      {!slotsLoading && !slotsError && allEmpty ? (
        <p className="vac-slot-pick__empty" role="status">
          No slots for this day. Please check an upcoming day or try the next day.
        </p>
      ) : null}

      {!slotsLoading && !slotsError
        ? SLOT_GROUPS.map((g) => {
            const chips =
              g.id === "morning"
                ? partitioned.morning
                : g.id === "afternoon"
                  ? partitioned.afternoon
                  : partitioned.evening;
            if (chips.length === 0) return null;
            return (
              <section key={g.id} className="vac-slot-pick__group" aria-label={g.label}>
                <div className="vac-slot-pick__group-head">
                  <SlotPeriodIcon period={g.id} />
                  {g.label}
                </div>
                <div className="vac-slot-pick__pills" role="radiogroup" aria-label={`${g.label} slots`}>
                  {chips.map((chip) => {
                    const on = selectedSlotKey === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={chip.disabled}
                        className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}${chip.disabled ? " vac-slot-pick__pill--disabled" : ""}`}
                        onClick={() => !chip.disabled && onSelectSlotKey(chip.key)}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        : null}
    </div>
  );
}
