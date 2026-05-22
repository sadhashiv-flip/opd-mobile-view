/**
 * Vaccination slot booking rules — mirrors patient-app `VaccineRepository.getDays()` +
 * `getSlotsForDate()` and `VaccineController` slot selection.
 */

export const VACCINATION_BOOKING_DAY_COUNT = 5;

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type VaccinationSlotRow = Readonly<{
  time: string;
  time24: string;
  isDisabled: boolean;
}>;

export type VaccinationDateChip = Readonly<{
  day: string;
  weekday: string;
}>;

export type VaccinationDayStripResult = Readonly<{
  dates: readonly Date[];
  calendarDateStrings: readonly string[];
  monthYearLabel: string;
  availableDates: readonly VaccinationDateChip[];
}>;

export type VaccinationSlotsByPeriod = Readonly<{
  morningSlots: readonly VaccinationSlotRow[];
  afternoonSlots: readonly VaccinationSlotRow[];
  eveningSlots: readonly VaccinationSlotRow[];
}>;

export const VACCINATION_PERIOD_GROUPS = [
  { id: "morning" as const, label: "Morning", key: "morningSlots" as const },
  { id: "afternoon" as const, label: "Afternoon", key: "afternoonSlots" as const },
  { id: "evening" as const, label: "Evening", key: "eveningSlots" as const },
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

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

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Dart `weekday`: 1 = Mon … 7 = Sun. */
function weekdayChip(d: Date): string {
  const dartWeekday = d.getDay() === 0 ? 7 : d.getDay();
  return WEEKDAY_NAMES[dartWeekday - 1] ?? "Mon";
}

function shortMonthYearLabel(d: Date): string {
  return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short month + year for display strings (e.g. overview / success). */
export function shortMonthYearFromDate(d: Date): string {
  return shortMonthYearLabel(d);
}

/** Convert 24-hour `"16:00"` → `"4:00 PM"` (mirrors `VaccineRepository._to12Hr`). */
export function vaccinationTime24To12h(hhmm: string): string {
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
 * Build the 5-day date strip: skip 1 day if before 18:00, else 2 (mirrors `getDays()`).
 * First selectable day is **tomorrow** (or day after tomorrow after 6 PM), not today.
 */
export function getVaccinationBookingDays(
  count: number = VACCINATION_BOOKING_DAY_COUNT,
  now: Date = new Date(),
): VaccinationDayStripResult {
  const skipDays = now.getHours() < 18 ? 1 : 2;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + skipDays);

  const dates: Date[] = [];
  const calendarDateStrings: string[] = [];
  const availableDates: VaccinationDateChip[] = [];

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
    monthYearLabel: shortMonthYearLabel(startDate),
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

function filterAndFormat24h(
  raw: readonly string[],
  date: Date,
  now: Date,
): VaccinationSlotRow[] {
  const dateStr = formatYmd(date);
  const out: VaccinationSlotRow[] = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const hm = raw[i];
    if (hm == null) continue;
    const [hh, mm] = hm.split(":").map(Number);
    const slotDt = new Date(`${dateStr}T${pad2(hh)}:${pad2(mm)}:00`);
    if (slotMoreThan24HoursFromNow(slotDt, now)) {
      out.push({
        time: vaccinationTime24To12h(hm),
        time24: hm,
        isDisabled: false,
      });
    }
  }
  return out;
}

/**
 * Morning 10:00–12:00, afternoon 12:00–13:00, evening 16:00–20:00 (skipped on Sunday).
 * Closing boundary hour is generated but not offered (`index < length - 1`).
 */
export function getVaccinationSlotsForDate(
  date: Date,
  now: Date = new Date(),
): VaccinationSlotsByPeriod {
  const isSunday = date.getDay() === 0;

  const morning = filterAndFormat24h(generateHourlySlots("10:00", "12:00"), date, now);
  const afternoon = filterAndFormat24h(generateHourlySlots("12:00", "13:00"), date, now);
  const evening = isSunday
    ? []
    : filterAndFormat24h(generateHourlySlots("16:00", "20:00"), date, now);

  return { morningSlots: morning, afternoonSlots: afternoon, eveningSlots: evening };
}

/** Flat 12h labels for the selected calendar day. */
export function flatVaccinationSlotLabelsForDay(day: Date, now: Date = new Date()): string[] {
  const b = getVaccinationSlotsForDate(day, now);
  return VACCINATION_PERIOD_GROUPS.flatMap((g) => b[g.key].map((r) => r.time));
}

export function firstDayWithBookableVaccinationSlots(
  stripDates: readonly Date[],
  now: Date = new Date(),
): Date {
  for (const d of stripDates) {
    if (flatVaccinationSlotLabelsForDay(d, now).length > 0) return d;
  }
  return stripDates[0] ?? startOfDay(now);
}

/** `VaccineController._parse12hSlot` */
export function parseVaccination12hSlot(raw: string | undefined | null): { h: number; m: number } | null {
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

/** `VaccineController._preferredDateTimeForApi` → `YYYY-MM-DD HH:mm:ss`. */
export function formatVaccinationPreferredDateTime(
  day: Date,
  slot12h: string | undefined | null,
): string | null {
  const t = parseVaccination12hSlot(slot12h);
  if (t == null) return null;
  return `${formatYmd(day)} ${pad2(t.h)}:${pad2(t.m)}:00`;
}

/** Display string like `VaccineController.selectedDateTimeDisplay`. */
export function formatVaccinationSlotDisplay(
  day: Date,
  slot12h: string,
  monthYear: string,
): string {
  return `${String(day.getDate())} ${weekdayChip(day)}, ${monthYear} | ${slot12h}`;
}

/** @deprecated Use {@link VACCINATION_PERIOD_GROUPS} via {@link getVaccinationSlotsForDate}. */
export const VACCINATION_SLOT_GROUPS = VACCINATION_PERIOD_GROUPS.map((g) => ({
  id: g.id,
  label: g.label,
  slots: [] as readonly string[],
}));

/** @deprecated Use {@link getVaccinationBookingDays}. */
export function getVaccinationBookingDates(
  count: number = VACCINATION_BOOKING_DAY_COUNT,
  _includeToday?: boolean,
): Date[] {
  return [...getVaccinationBookingDays(count).dates];
}

/** @deprecated Use {@link flatVaccinationSlotLabelsForDay}. */
export function filterSlotsForDay(
  day: Date,
  _slots: readonly string[],
  now?: Date,
): string[] {
  return flatVaccinationSlotLabelsForDay(day, now);
}

/** @deprecated Use {@link slotMoreThan24HoursFromNow} via {@link getVaccinationSlotsForDate}. */
export function isVaccinationSlotBookable(day: Date, slot12h: string, now: Date = new Date()): boolean {
  return flatVaccinationSlotLabelsForDay(day, now).includes(slot12h);
}

/** @deprecated Use {@link parseVaccination12hSlot}. */
export function combineDayAndSlot12h(day: Date, slot12h: string): Date {
  const t = parseVaccination12hSlot(slot12h);
  if (t == null) return new Date(day);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m, 0, 0);
}
