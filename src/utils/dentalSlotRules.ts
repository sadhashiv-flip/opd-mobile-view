/**
 * Dental slot booking rules — mirrors patient-app `DentalRepository.getDays()` +
 * `getSlotsForDate()` and `DentalController` slot selection.
 */

import { startOfDay } from "@/components/vaccination/vaccinationSlotRules";

export { sameCalendarDay } from "@/components/vaccination/vaccinationSlotRules";

export const DENTAL_BOOKING_DAY_COUNT = 6;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type DentalSlotRow = Readonly<{
  time: string;
  time24: string;
  isDisabled: boolean;
}>;

export type DentalDateChip = Readonly<{
  day: string;
  weekday: string;
}>;

export type DentalDayStripResult = Readonly<{
  dates: readonly Date[];
  calendarDateStrings: readonly string[];
  monthYearLabel: string;
  availableDates: readonly DentalDateChip[];
}>;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Dart `weekday`: 1 = Mon … 7 = Sun. */
function weekdayChip(d: Date): string {
  const dartWeekday = d.getDay() === 0 ? 7 : d.getDay();
  return WEEKDAY_NAMES[dartWeekday - 1] ?? "Mon";
}

function monthYearLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Convert 24-hour `"16:00"` → `"4:00 PM"` (mirrors `DentalRepository._to12Hr`). */
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
 * Build the date strip: skip 1 day if before 18:00, else 2 (mirrors `getDays()`).
 * Returns 6 consecutive calendar days from that anchor.
 */
export function getDentalBookingDays(
  count: number = DENTAL_BOOKING_DAY_COUNT,
  now: Date = new Date(),
): DentalDayStripResult {
  const skipDays = now.getHours() < 18 ? 1 : 2;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + skipDays);

  const dates: Date[] = [];
  const calendarDateStrings: string[] = [];
  const availableDates: DentalDateChip[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
    calendarDateStrings.push(formatYmd(date));
    availableDates.push({
      day: String(date.getDate()),
      weekday: weekdayChip(date),
    });
  }

  return {
    dates,
    calendarDateStrings,
    monthYearLabel: monthYearLabel(startDate),
    availableDates,
  };
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

/** Mirrors `slotDt.difference(now).inHours > 24`. */
function slotMoreThan24HoursFromNow(slotDt: Date, now: Date): boolean {
  const diffMs = slotDt.getTime() - now.getTime();
  if (diffMs <= 0) return false;
  return Math.floor(diffMs / (60 * 60 * 1000)) > 24;
}

function filterAndFormat24h(raw: readonly string[], date: Date, now: Date): DentalSlotRow[] {
  const dateStr = formatYmd(date);
  const out: DentalSlotRow[] = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const hm = raw[i];
    if (hm == null) continue;
    const [hh, mm] = hm.split(":").map(Number);
    const slotDt = new Date(`${dateStr}T${pad2(hh)}:${pad2(mm)}:00`);
    if (slotMoreThan24HoursFromNow(slotDt, now)) {
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
 * Closing boundary hour is generated but not offered (index `< length - 1`).
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

/** `DentalController._parse12hSlot` */
export function parseDental12hSlot(raw: string | undefined | null): { h: number; m: number } | null {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase().replace(/\./g, "");
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/.exec(s);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ap = match[3];
  if (ap === "PM" && hour !== 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;
  return { h: hour, m: minute };
}

/** `DentalController._preferredDateTimeForApi` → `YYYY-MM-DD HH:mm:ss`. */
export function formatDentalPreferredDateTime(
  day: Date,
  slot12h: string | undefined | null,
): string | null {
  const t = parseDental12hSlot(slot12h);
  if (t == null) return null;
  return `${formatYmd(day)} ${pad2(t.h)}:${pad2(t.m)}:00`;
}

/** Display string like `DentalController.selectedDateTimeDisplay`. */
export function formatDentalSlotDisplay(
  day: Date,
  slot12h: string,
  monthYear: string,
): string {
  const chip = {
    day: String(day.getDate()),
    weekday: weekdayChip(day),
  };
  return `${chip.day} ${chip.weekday}, ${monthYear} | ${slot12h}`;
}
