import type { NetworkDoctorSchedule, NetworkSlotTiming } from "@/api/networkSlots";

export type SlotCategory = "morning" | "afternoon" | "evening";

export type GeneratedSlot = Readonly<{
  timingId: number;
  minutesFromMidnight: number;
  label: string;
}>;

/** JS weekday: 0 Sun … 6 Sat — matches `Date#getDay()`. */
export function dayNameToWeekIndex(name: string): number | null {
  const n = name.trim().toLowerCase().replace(/\.$/, "");
  const map: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thur: 4,
    thurs: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  return map[n] ?? null;
}

export function findScheduleForDate(
  schedules: readonly NetworkDoctorSchedule[],
  date: Date,
): NetworkDoctorSchedule | undefined {
  const want = date.getDay();
  return schedules.find((s) => dayNameToWeekIndex(s.day) === want);
}

/** Five consecutive calendar days starting tomorrow (local date), noon anchor avoids DST quirks. */
export function buildFiveCalendarDaysStartingTomorrow(): Date[] {
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + 1);
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d0 = anchor.getDate();
  const out: Date[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(new Date(y, m, d0 + i));
  }
  return out;
}

export function parseTimeToMinutes(t: string): number | null {
  const s = t.trim().replaceAll(/\s+/g, " ");
  const re = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i;
  const m = re.exec(s);
  if (!m) return null;
  let h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTimeLabel(total: number): string {
  let h = Math.floor(total / 60);
  const mm = total % 60;
  const ap = h >= 12 ? "PM" : "AM";
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}:${String(mm).padStart(2, "0")} ${ap}`;
}

/**
 * 15-minute slot **start** times from `opening` through **`closing` inclusive**
 * (e.g. 10:00 AM–4:00 PM → … 3:45 PM, **4:00 PM**).
 */
export function generateSlotsFromTimings(timings: readonly NetworkSlotTiming[]): GeneratedSlot[] {
  const slots: GeneratedSlot[] = [];
  for (const tm of timings) {
    const open = parseTimeToMinutes(tm.opening);
    const close = parseTimeToMinutes(tm.closing);
    if (open === null || close === null) continue;
    if (close <= open) continue;
    for (let t = open; t <= close; t += 15) {
      slots.push({
        timingId: tm.id,
        minutesFromMidnight: t,
        label: minutesToTimeLabel(t),
      });
    }
  }
  slots.sort((a, b) => a.minutesFromMidnight - b.minutesFromMidnight);
  return slots;
}

export function categorizeSlotMinutes(mins: number): SlotCategory {
  if (mins < 12 * 60) return "morning";
  if (mins < 17 * 60) return "afternoon";
  return "evening";
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Drop slot starts that are not after "now" when the user is booking for today.
 * (Carousel normally starts tomorrow; this is a safeguard.)
 */
export function filterSlotsAfterNowIfToday(calDate: Date, slots: readonly GeneratedSlot[]): GeneratedSlot[] {
  const now = new Date();
  if (!isSameCalendarDay(calDate, now)) return [...slots];
  const cut = now.getHours() * 60 + now.getMinutes();
  return slots.filter((s) => s.minutesFromMidnight > cut);
}

const CATEGORY_ORDER: readonly SlotCategory[] = ["morning", "afternoon", "evening"];

const CATEGORY_LABEL: Record<SlotCategory, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function groupSlotsByCategory(
  slots: readonly GeneratedSlot[],
): ReadonlyArray<{ category: SlotCategory; title: string; slots: GeneratedSlot[] }> {
  const buckets: Record<SlotCategory, GeneratedSlot[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const s of slots) {
    buckets[categorizeSlotMinutes(s.minutesFromMidnight)].push(s);
  }
  return CATEGORY_ORDER.filter((c) => buckets[c].length > 0).map((c) => ({
    category: c,
    title: CATEGORY_LABEL[c],
    slots: buckets[c],
  }));
}
