/** Vaccination slot booking rules (local time). */

export const VACCINATION_BOOKING_DAY_COUNT = 5;

/** Morning: 10–12 (1h); afternoon: 12 PM; evening: 4–7 PM (1h). */
export const VACCINATION_SLOT_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  slots: readonly string[];
}> = [
  { id: "morning", label: "Morning", slots: ["10:00 AM", "11:00 AM"] },
  { id: "afternoon", label: "Afternoon", slots: ["12:00 PM"] },
  {
    id: "evening",
    label: "Evening",
    slots: ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"],
  },
];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Horizontal date strip: **5 consecutive days** (local calendar).
 * - Default `includeToday: true`: **today** through **today + 4**.
 * - `includeToday: false`: **tomorrow** through **tomorrow + 4**.
 */
export function getVaccinationBookingDates(
  count: number = VACCINATION_BOOKING_DAY_COUNT,
  includeToday: boolean = true,
): Date[] {
  const today = startOfDay(new Date());
  const first = includeToday ? today : addDays(today, 1);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(addDays(first, i));
  }
  return out;
}

function parse12hToMinutesFromMidnight(slot12h: string): number {
  const m = slot12h.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

/** Calendar day + wall-clock slot → instant (local). */
export function combineDayAndSlot12h(day: Date, slot12h: string): Date {
  const mins = parse12hToMinutesFromMidnight(slot12h);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
  return d;
}

/**
 * Bookable iff the slot’s **absolute** start time is **strictly after** `now`
 * (e.g. at 5:03 PM today, 5:00 PM is hidden and 6:00 PM is shown).
 */
export function isVaccinationSlotBookable(day: Date, slot12h: string, now: Date = new Date()): boolean {
  return combineDayAndSlot12h(day, slot12h).getTime() > now.getTime();
}

export function filterSlotsForDay(day: Date, slots: readonly string[], now?: Date): string[] {
  const t = now ?? new Date();
  return slots.filter((s) => isVaccinationSlotBookable(day, s, t));
}

/** First strip day that still has at least one slot after `now` (e.g. late today → tomorrow). */
export function firstDayWithBookableVaccinationSlots(
  stripDates: readonly Date[],
  now: Date = new Date(),
): Date {
  for (const d of stripDates) {
    const n = VACCINATION_SLOT_GROUPS.flatMap((g) => filterSlotsForDay(d, g.slots, now)).length;
    if (n > 0) return d;
  }
  return stripDates[0] ?? startOfDay(now);
}
