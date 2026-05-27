import type { VendorDatedSlot } from "@/api/networkSlots";
import type { HospitalVendorMeta } from "@/constants/consultationBookingStorage";
import {
  categorizeSlotMinutes,
  isSameCalendarDay,
  minutesToTimeLabel,
  type SlotCategory,
} from "@/utils/consultationSlotGrid";

export type VendorSlotPick = Readonly<{
  vendorSlotId: string;
  time24: string;
  label: string;
  minutesFromMidnight: number;
}>;

export function isVendorOfflineSlots(vendorMeta: HospitalVendorMeta | null | undefined): boolean {
  return vendorMeta != null && vendorMeta.source.trim().length > 0;
}

function normalizeDateKey(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return "";
}

function normalizeTime24(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (s.includes(" ")) {
    const parts = s.split(/\s+/);
    if (parts.length >= 2) {
      const tp = parts[0].split(":");
      if (tp.length >= 2) {
        let h = Number.parseInt(tp[0], 10);
        const min = Number.parseInt(tp[1], 10);
        const ap = parts[1].toUpperCase();
        if (ap === "PM" && h >= 1 && h <= 11) h += 12;
        if (ap === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      }
    }
  }
  const tp = s.split(":");
  if (tp.length >= 2) {
    const h = Number.parseInt(tp[0], 10);
    const min = Number.parseInt(tp[1], 10);
    if (Number.isFinite(h) && Number.isFinite(min)) {
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }
  return "";
}

/** Port of Dart `NetworkDoctorSchedule._parseDatedSlots` / schedule timings. */
export function parseVendorDatedSlotsFromDoctorJson(doc: Record<string, unknown>): VendorDatedSlot[] {
  const fromSlots = parseDatedSlotsList(doc.slots);
  if (fromSlots.length > 0) return fromSlots;
  return parseDatedSlotsFromSchedules(doc.schedules);
}

function parseDatedSlotsList(raw: unknown): VendorDatedSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: VendorDatedSlot[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const map = item as Record<string, unknown>;
    const date = normalizeDateKey(map.date ?? map.slot_date ?? map.appointment_date);
    const time = normalizeTime24(
      map.time_slot ?? map.time ?? map.slot_time ?? map.start_time ?? map.opening,
    );
    if (!date || !time) continue;
    const vendorSlotId = String(map.id ?? map.slot_id ?? "").trim();
    out.push({ date, time, vendorSlotId });
  }
  return out;
}

function parseDatedSlotsFromSchedules(raw: unknown): VendorDatedSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: VendorDatedSlot[] = [];
  for (const sched of raw) {
    if (sched == null || typeof sched !== "object") continue;
    const map = sched as Record<string, unknown>;
    const scheduleDate = normalizeDateKey(map.date);
    const timings = map.timings;
    if (!Array.isArray(timings)) continue;
    for (const t of timings) {
      if (t == null || typeof t !== "object") continue;
      const tm = t as Record<string, unknown>;
      const date = normalizeDateKey(tm.date ?? scheduleDate);
      const time = normalizeTime24(tm.opening);
      if (!date || !time) continue;
      const vendorSlotId = String(tm.id ?? "").trim();
      out.push({ date, time, vendorSlotId });
    }
  }
  return out;
}

export function vendorSlotKey(pick: VendorSlotPick): string {
  return `vendor-${pick.vendorSlotId || pick.time24}`;
}

export function buildLegacyCalendarDays(): Date[] {
  const now = new Date();
  const skipDays = now.getHours() < 19 ? 1 : 2;
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + skipDays);
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d0 = anchor.getDate();
  const out: Date[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(new Date(y, m, d0 + i));
  }
  return out;
}

export function buildVendorCalendarDays(datedSlots: readonly VendorDatedSlot[]): Date[] {
  const dates = [...new Set(datedSlots.map((s) => s.date).filter(Boolean))].sort();
  return dates
    .map((dateStr) => {
      const d = Date.parse(`${dateStr}T12:00:00`);
      return Number.isNaN(d) ? null : new Date(d);
    })
    .filter((d): d is Date => d != null);
}

export function defaultVendorDayIndex(days: readonly Date[], datedSlots: readonly VendorDatedSlot[]): number {
  if (days.length === 0) return 0;
  const now = new Date();
  const todayKey = formatDateKey(now);
  const hasToday = datedSlots.some((s) => s.date === todayKey);
  if (hasToday) {
    const idx = days.findIndex((d) => isSameCalendarDay(d, now));
    if (idx >= 0) return idx;
  }
  return 0;
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function slotsForVendorDate(
  datedSlots: readonly VendorDatedSlot[],
  calDate: Date,
): VendorSlotPick[] {
  const dateKey = formatDateKey(calDate);
  const now = new Date();
  const out: VendorSlotPick[] = [];
  for (const slot of datedSlots) {
    if (slot.date !== dateKey) continue;
    const mins = parseTimeToMinutesFrom24(slot.time);
    if (mins == null) continue;
    const slotDt = new Date(calDate);
    slotDt.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    if (slotDt.getTime() <= now.getTime() && isSameCalendarDay(calDate, now)) continue;
    out.push({
      vendorSlotId: slot.vendorSlotId,
      time24: slot.time,
      label: minutesToTimeLabel(mins),
      minutesFromMidnight: mins,
    });
  }
  const seen = new Set<string>();
  const unique: VendorSlotPick[] = [];
  for (const p of out.sort((a, b) => a.minutesFromMidnight - b.minutesFromMidnight)) {
    const k = `${p.time24}-${p.vendorSlotId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  return unique;
}

function parseTimeToMinutesFrom24(time24: string): number | null {
  const parts = time24.split(":");
  if (parts.length < 2) return null;
  const h = Number.parseInt(parts[0], 10);
  const m = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

const CATEGORY_ORDER: readonly SlotCategory[] = ["morning", "afternoon", "evening"];

const CATEGORY_LABEL: Record<SlotCategory, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function groupVendorSlotsByCategory(
  slots: readonly VendorSlotPick[],
): ReadonlyArray<{ category: SlotCategory; title: string; slots: VendorSlotPick[] }> {
  const buckets: Record<SlotCategory, VendorSlotPick[]> = {
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

/** Vendor book API: `yyyy-MM-dd, h:mm am/pm` (comma + lowercase meridiem). */
export function formatVendorBookTimeSlot(calDate: Date, time24: string): string {
  const dateStr = formatDateKey(calDate);
  const mins = parseTimeToMinutesFrom24(time24);
  const label = mins != null ? minutesToTimeLabel(mins) : time24;
  return `${dateStr}, ${label.toLowerCase()}`;
}

/** 12h display for vendor reschedule (Dart `rescheduleSlotDisplay12`). */
export function vendorTime24To12Label(time24: string): string {
  const mins = parseTimeToMinutesFrom24(time24);
  return mins != null ? minutesToTimeLabel(mins) : time24;
}

export function findVendorSlotByKey(
  datedSlots: readonly VendorDatedSlot[],
  dateKey: string,
  slotKey: string,
): VendorSlotPick | null {
  const slots = slotsForVendorDate(
    datedSlots,
    new Date(`${dateKey}T12:00:00`),
  );
  return slots.find((s) => vendorSlotKey(s) === slotKey) ?? null;
}

export function resolveVendorSlotId(
  datedSlots: readonly VendorDatedSlot[],
  dateKey: string,
  time24: string,
): string {
  const match = datedSlots.find((s) => s.date === dateKey && s.time === time24);
  return match?.vendorSlotId?.trim() ?? "";
}

/** Same calendar day check using epoch ms (for order detail QR). */
export function isSameCalendarDayMs(startMs: number | null | undefined, refMs = Date.now()): boolean {
  if (startMs == null || !Number.isFinite(startMs)) return false;
  return isSameCalendarDay(new Date(startMs), new Date(refMs));
}
