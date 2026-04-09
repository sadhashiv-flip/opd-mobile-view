/**
 * Dental slot booking rules — mirrors patient-app `getDays()` + `getSlotsForDate()`.
 */

import { startOfDay } from "@/components/vaccination/vaccinationSlotRules";

export { sameCalendarDay } from "@/components/vaccination/vaccinationSlotRules";

export const DENTAL_BOOKING_DAY_COUNT = 6;

export type DentalSlotRow = Readonly<{
  time: string;
  time24: string;
  isDisabled: boolean;
}>;

export type DentalDayStripResult = Readonly<{
  dates: readonly Date[];
  calendarDateStrings: readonly string[];
}>;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Convert 24-hour `"16:00"` → `"4:00 PM"`. */
export function dentalTime24To12h(hhmm: string): string {
  const parts = hhmm.split(":");
  let h = Number(parts[0]);
  const m = Number(parts[1]);
  const amPm = h >= 12 ? "PM" : "AM";
  if (h === 0) {
    h = 12;
  } else if (h > 12) {
    h -= 12;
  }
  return `${h}:${pad2(m)} ${amPm}`;
}

/**
 * Build the date strip: `skipDays` is 1 if before 18:00, else 2 (mirrors patient-app).
 * Returns **6** consecutive calendar days from that anchor (noon anchor avoids DST quirks).
 */
export function getDentalBookingDays(
  count: number = DENTAL_BOOKING_DAY_COUNT,
  now: Date = new Date(),
): DentalDayStripResult {
  const skipDays = now.getHours() < 18 ? 1 : 2;
  const anchor = new Date(now);
  anchor.setDate(anchor.getDate() + skipDays);
  anchor.setHours(12, 0, 0, 0);
  const y = anchor.getFullYear();
  const mo = anchor.getMonth();
  const d0 = anchor.getDate();

  const dates: Date[] = [];
  const calendarDateStrings: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(y, mo, d0 + i);
    dates.push(date);
    calendarDateStrings.push(formatYmd(date));
  }

  return { dates, calendarDateStrings };
}

function generateHourlySlots(opening: string, closing: string): string[] {
  const [openH, openM] = opening.split(":").map(Number);
  const [closeH, closeM] = closing.split(":").map(Number);
  let h = openH;
  let m = openM;
  const slots: string[] = [];
  while (h < closeH || (h === closeH && m <= closeM)) {
    slots.push(`${pad2(h)}:${pad2(m)}`);
    const next = new Date(2000, 0, 1, h, m, 0, 0);
    next.setHours(next.getHours() + 1);
    h = next.getHours();
    m = next.getMinutes();
  }
  return slots;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function filterAndFormat24h(raw: readonly string[], date: Date, now: Date): DentalSlotRow[] {
  const y = date.getFullYear();
  const out: DentalSlotRow[] = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const hm = raw[i];
    if (hm == null) continue;
    const [hh, mm] = hm.split(":").map(Number);
    const slotDt = new Date(y, date.getMonth(), date.getDate(), hh, mm, 0, 0);
    if (slotDt.getTime() - now.getTime() > MS_PER_DAY) {
      out.push({
        time: dentalTime24To12h(hm),
        time24: hm,
        isDisabled: false,
      });
    }
  }
  return out;
}

export type DentalSlotsByPeriod = Readonly<{
  morningSlots: readonly DentalSlotRow[];
  afternoonSlots: readonly DentalSlotRow[];
  eveningSlots: readonly DentalSlotRow[];
}>;

/**
 * Morning 10:00–12:00, afternoon 12:00–13:00, evening 16:00–20:00 (skipped on Sunday).
 * Last element of each generated range is the closing boundary and is not selectable.
 * Slots require **more than 24 hours** from `now` (mirrors patient-app `inHours > 24` intent).
 */
export function getDentalSlotsForDate(date: Date, now: Date = new Date()): DentalSlotsByPeriod {
  const isSunday = date.getDay() === 0;

  const morning = filterAndFormat24h(generateHourlySlots("10:00", "12:00"), date, now);
  const afternoon = filterAndFormat24h(generateHourlySlots("12:00", "13:00"), date, now);
  const evening = isSunday
    ? []
    : filterAndFormat24h(generateHourlySlots("16:00", "20:00"), date, now);

  return { morningSlots: morning, afternoonSlots: afternoon, eveningSlots: evening };
}

const DENTAL_GROUPS = [
  { id: "morning" as const, label: "Morning", key: "morningSlots" as const },
  { id: "afternoon" as const, label: "Afternoon", key: "afternoonSlots" as const },
  { id: "evening" as const, label: "Evening", key: "eveningSlots" as const },
];

/** Flat 12h labels for the selected calendar day (for validation / empty checks). */
export function flatDentalSlotLabelsForDay(day: Date, now: Date = new Date()): string[] {
  const b = getDentalSlotsForDate(day, now);
  return DENTAL_GROUPS.flatMap((g) => b[g.key].map((r) => r.time));
}

export function firstDayWithBookableDentalSlots(
  stripDates: readonly Date[],
  now: Date = new Date(),
): Date {
  for (const d of stripDates) {
    if (flatDentalSlotLabelsForDay(d, now).length > 0) return d;
  }
  return stripDates[0] ?? startOfDay(now);
}
