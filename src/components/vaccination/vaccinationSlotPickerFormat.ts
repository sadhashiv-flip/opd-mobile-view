import {
  formatVaccinationPreferredDateTime,
  formatVaccinationSlotDisplay,
  parseVaccination12hSlot,
  shortMonthYearFromDate,
} from "@/components/vaccination/vaccinationSlotRules";

/** Build `YYYY-MM-DD HH:mm:ss` for the vaccine request payload. */
export function formatPreferredApiDateTime(day: Date, slot12h: string | undefined | null): string {
  return formatVaccinationPreferredDateTime(day, slot12h) ?? "";
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
  const h = Number(p[4]);
  const mi = Number(p[5]);
  const day = new Date(y, mo - 1, da);
  let hr12 = h % 12;
  if (hr12 === 0) hr12 = 12;
  const ap = h >= 12 ? "PM" : "AM";
  const slot12h = `${hr12}:${String(mi).padStart(2, "0")} ${ap}`;
  return { day, slot12h };
}

/** `VaccineController.selectedDateTimeDisplay` from stored API datetime. */
export function formatVaccineSlotDisplay(api: string | undefined | null): string {
  if (api == null || typeof api !== "string") return "";
  const parsed = parsePreferredApiDateTime(api);
  if (!parsed) return api.trim() ? api : "";
  return formatVaccinationSlotDisplay(
    parsed.day,
    parsed.slot12h,
    shortMonthYearFromDate(parsed.day),
  );
}

/** @deprecated Use {@link parseVaccination12hSlot}. */
export function parse12hLabel(label: string | undefined | null): { h: number; m: number } {
  return parseVaccination12hSlot(label) ?? { h: 10, m: 0 };
}
