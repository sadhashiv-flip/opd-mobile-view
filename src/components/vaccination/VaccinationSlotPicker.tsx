import { useEffect, useMemo, useState } from "react";
import {
  filterSlotsForDay,
  getVaccinationBookingDates,
  sameCalendarDay,
  VACCINATION_BOOKING_DAY_COUNT,
  VACCINATION_SLOT_GROUPS,
} from "@/components/vaccination/vaccinationSlotRules";
import "@/pages/HealthCheckupsPage.css";
import "./VaccinationSlotPicker.css";

/** @deprecated Use {@link VACCINATION_SLOT_GROUPS} from vaccinationSlotRules */
export const VACCINE_SLOT_GROUPS = VACCINATION_SLOT_GROUPS;

/** @deprecated Use {@link getVaccinationBookingDates} */
export function vaccineDateStrip(count: number = 14): Date[] {
  return getVaccinationBookingDates(count, true).slice(0, count);
}

function parse12hLabel(label: string | undefined | null): { h: number; m: number } {
  if (label == null || typeof label !== "string") return { h: 10, m: 0 };
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return { h: 10, m: 0 };
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return { h, m: min };
}

/** Build `YYYY-MM-DD HH:mm:ss` for the vaccine request payload. */
export function formatPreferredApiDateTime(day: Date, slot12h: string | undefined | null): string {
  const { h, m } = parse12hLabel(slot12h);
  const y = day.getFullYear();
  const mo = String(day.getMonth() + 1).padStart(2, "0");
  const da = String(day.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function parsePreferredApiDateTime(
  api: string | undefined | null,
): { day: Date; slot12h: string } | null {
  if (api == null || typeof api !== "string") return null;
  const t = api.trim();
  const re = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;
  const p = t.match(re);
  if (!p) return null;
  const y = Number(p[1]);
  const mo = Number(p[2]);
  const da = Number(p[3]);
  let h = Number(p[4]);
  const mi = Number(p[5]);
  const day = new Date(y, mo - 1, da);
  let hr12 = h % 12;
  if (hr12 === 0) hr12 = 12;
  const ap = h >= 12 ? "PM" : "AM";
  const slot12h = `${hr12}:${String(mi).padStart(2, "0")} ${ap}`;
  return { day, slot12h };
}

export function formatVaccineSlotDisplay(api: string | undefined | null): string {
  if (api == null || typeof api !== "string") return "";
  const parsed = parsePreferredApiDateTime(api);
  if (!parsed) return api.trim() ? api : "";
  const { day, slot12h } = parsed;
  const d = day.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${d} | ${slot12h}`;
}

export type VaccinationSlotPickerProps = Readonly<{
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
  /** Renders Continue when provided */
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  /**
   * Number of consecutive days in the strip (default 5).
   * With `includeToday` true (default), the strip starts **today**.
   */
  bookingDayCount?: number;
  /**
   * When true (default), first chip is **today** — only slots **after** current time show.
   * When false, first chip is **tomorrow**.
   */
  includeToday?: boolean;
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
  includeToday = true,
  showContinueFooter = true,
}: VaccinationSlotPickerProps) {
  /** Refresh so slots hide as the current time passes each start time. */
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const bookingNow = useMemo(() => new Date(nowTick), [nowTick]);

  const dates = useMemo(
    () => getVaccinationBookingDates(bookingDayCount, includeToday),
    [bookingDayCount, includeToday],
  );

  const monthLabel = selectedDay.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  const flatAvailable = useMemo(
    () =>
      VACCINATION_SLOT_GROUPS.flatMap((g) => filterSlotsForDay(selectedDay, g.slots, bookingNow)),
    [selectedDay, bookingNow],
  );

  /** No default slot: only clear when empty day or current pick is no longer valid. */
  useEffect(() => {
    const flat = VACCINATION_SLOT_GROUPS.flatMap((g) =>
      filterSlotsForDay(selectedDay, g.slots, bookingNow),
    );
    if (flat.length === 0) {
      if (selectedSlot !== null) onSelectSlot(null);
      return;
    }
    if (selectedSlot !== null && !flat.includes(selectedSlot)) {
      onSelectSlot(null);
    }
  }, [selectedDay, selectedSlot, onSelectSlot, bookingNow]);

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

      {VACCINATION_SLOT_GROUPS.map((g) => {
        const slots = filterSlotsForDay(selectedDay, g.slots, bookingNow);
        if (slots.length === 0) return null;
        return (
          <section key={g.id} className="vac-slot-pick__group">
            <div className="vac-slot-pick__group-head">
              <span className="vac-slot-pick__sun" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                  <path
                    d="M12 2v2M12 20v2M2 12h2M20 12h2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              {g.label}
            </div>
            <div className="vac-slot-pick__pills">
              {slots.map((slot) => {
                const on = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}`}
                    onClick={() => onSelectSlot(slot)}
                  >
                    {slot}
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
