import type { AvailableSlot } from "@/api/consultationVirtual";
import { formatLocalYmd } from "@/api/consultationVirtual";

export type VirtualSlotChip = Readonly<{
  key: string;
  label: string;
  disabled: boolean;
}>;

/** patient_app `SlotModel.available` — API sends `0` / `false` when unavailable. */
export function isVirtualSlotAvailable(available: string): boolean {
  const v = available.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

function slotHour24(time: string): number {
  const part = time.trim().split(":")[0] ?? "";
  const h = Number.parseInt(part, 10);
  return Number.isFinite(h) ? h : 0;
}

function slotChipFromApi(s: AvailableSlot): VirtualSlotChip {
  const label = s.displayTime.trim() || s.time.trim();
  return {
    key: `${s.date}|${s.time}`,
    label,
    disabled: !isVirtualSlotAvailable(s.available),
  };
}

export function partitionVirtualSlots(slots: readonly AvailableSlot[]): Readonly<{
  morning: readonly VirtualSlotChip[];
  afternoon: readonly VirtualSlotChip[];
  evening: readonly VirtualSlotChip[];
}> {
  const morning: VirtualSlotChip[] = [];
  const afternoon: VirtualSlotChip[] = [];
  const evening: VirtualSlotChip[] = [];

  for (const s of slots) {
    const chip = slotChipFromApi(s);
    const h = slotHour24(s.time);
    if (h >= 6 && h < 12) morning.push(chip);
    else if (h >= 12 && h < 17) afternoon.push(chip);
    else evening.push(chip);
  }

  return { morning, afternoon, evening };
}

/** patient_app `nextSevenDays` — today + next 6 days. */
export function getVirtualBookingDates(count = 7): Date[] {
  const n = Math.max(1, count);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseSlotDateYmd(ymd: string): Date | null {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function monthYearIstLabel(day: Date): string {
  const month = day.toLocaleDateString("en-IN", { month: "long" });
  const year = day.getFullYear();
  return `${month} ${year} (IST)`;
}

export function todayYmd(): string {
  return formatLocalYmd(new Date());
}
