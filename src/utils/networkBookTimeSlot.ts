/** Build `time_slot` for `POST /appointment/network_book`, e.g. `2026-04-02 10:40 AM`. */

const DAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function nextOccurrenceOfWeekday(dayName: string): Date {
  const norm = dayName.trim().toLowerCase().replace(/\.$/, "");
  const target = DAY_TO_INDEX[norm];
  const d = new Date();
  if (target === undefined) return d;
  const today = d.getDay();
  let add = target - today;
  if (add < 0) add += 7;
  d.setDate(d.getDate() + add);
  return d;
}

function normalizeAmPmTime(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  const match = t.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (!match) return t;
  const hh = match[1].padStart(2, "0");
  const mm = match[2];
  const ap = match[3].toUpperCase();
  return `${hh}:${mm} ${ap}`;
}

/**
 * @param dayName — e.g. `"Tuesday"` from slot schedule
 * @param openingTime — e.g. `"10:00 am"` from API timing
 */
export function formatNetworkBookTimeSlot(dayName: string, openingTime: string): string {
  const d = nextOccurrenceOfWeekday(dayName);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${y}-${m}-${day}`;
  const timePart = normalizeAmPmTime(openingTime);
  return `${datePart} ${timePart}`;
}

/** Prefer this when the exact calendar day is already chosen in the slot UI. */
export function formatNetworkBookTimeSlotForDate(date: Date, time12h: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePart = `${y}-${m}-${day}`;
  const timePart = normalizeAmPmTime(time12h);
  return `${datePart} ${timePart}`;
}
