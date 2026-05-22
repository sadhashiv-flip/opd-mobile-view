import type { VisionServiceSlotRow, VisionServiceSlotsData } from "@/api/visionServiceSlots";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** patient_app `VisionRepository._monthName` + `_applySlotsResult` `monthYearLabel` (from `daysList.first`). */
export function visionMonthYearLabelFromDaysList(daysList: readonly string[]): string {
  const first = daysList[0]?.trim();
  if (!first) return "";
  const iso = first.includes("T") ? first : `${first}T12:00:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return `${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** patient_app `VisionRepository._weekdayName` — `DateTime.weekday` 1=Mon … 7=Sun. */
export function visionWeekdayShort(isoDate: string): string {
  const iso = isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const js = dt.getDay();
  const idx = js === 0 ? 6 : js - 1;
  return days[idx] ?? "";
}

/** patient_app `availableDates` rows (`day` + `weekday`) from `daysList`. */
export function visionDayNumberFromIso(isoDate: string): string {
  const iso = isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return String(dt.getDate());
}

/**
 * patient_app `selectTimeSlot` → `selectedDateTimeDisplay`:
 * `{day} {weekday}, {monthYearLabel} | {start_time}`.
 */
export function formatVisionSlotScheduleDisplay(
  isoDate: string,
  startTime: string,
  monthYearLabel: string,
): string {
  const day = visionDayNumberFromIso(isoDate);
  const weekday = visionWeekdayShort(isoDate);
  const time = startTime.trim() || "—";
  const month = monthYearLabel.trim();
  if (!month) return `${day} ${weekday} | ${time}`.trim();
  return `${day} ${weekday}, ${month} | ${time}`;
}

export function findVisionSlotInPayload(
  data: VisionServiceSlotsData,
  slotId: string,
): VisionServiceSlotRow | null {
  const all = [...data.slots.morning, ...data.slots.afternoon, ...data.slots.evening];
  return all.find((s) => s.slot_id === slotId) ?? null;
}

/** patient_app: slot lists come from API for the active date — no client filter. */
export function visionSlotsAllEmpty(slots: VisionServiceSlotsData["slots"]): boolean {
  return (
    slots.morning.length === 0 &&
    slots.afternoon.length === 0 &&
    slots.evening.length === 0
  );
}
