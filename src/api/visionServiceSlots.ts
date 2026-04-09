import { patientJson } from "@/api/patientHttp";
import { encodeLocationQueryParam, type VisionNetworkService } from "@/api/networkList";

export type VisionServiceSlotRow = Readonly<{
  slot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
}>;

export type VisionServiceSlotsData = Readonly<{
  daysList: readonly string[];
  slots: Readonly<{
    morning: VisionServiceSlotRow[];
    afternoon: VisionServiceSlotRow[];
    evening: VisionServiceSlotRow[];
  }>;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function normalizeSlotRow(raw: unknown): VisionServiceSlotRow | null {
  const r = asRecord(raw);
  if (!r) return null;
  const slot_id = str(r.slot_id);
  const slot_date = str(r.slot_date);
  const start_time = str(r.start_time);
  const end_time = str(r.end_time);
  if (!slot_id || !slot_date || !start_time) return null;
  return { slot_id, slot_date, start_time, end_time };
}

function parseSlotsPayload(body: unknown): VisionServiceSlotsData | null {
  const root = asRecord(body);
  const data = root ? asRecord(root.data) : null;
  if (!data) return null;
  const daysRaw = data.daysList;
  const daysList = Array.isArray(daysRaw)
    ? daysRaw.map((x) => str(x)).filter((d) => d.length > 0)
    : [];
  const slotsRoot = asRecord(data.slots);
  const parsePeriod = (key: "morning" | "afternoon" | "evening"): VisionServiceSlotRow[] => {
    if (!slotsRoot) return [];
    const arr = slotsRoot[key];
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => normalizeSlotRow(x)).filter((x): x is VisionServiceSlotRow => x !== null);
  };
  return {
    daysList,
    slots: {
      morning: parsePeriod("morning"),
      afternoon: parsePeriod("afternoon"),
      evening: parsePeriod("evening"),
    },
  };
}

export type FetchVisionServiceSlotsParams = Readonly<{
  location: string;
  service: VisionNetworkService;
  /** Network / clinic id from vision `network/list` row (`networkEntityId`). */
  networkId: string;
}>;

/**
 * `GET /service/slots?location=&service=&network_id=`
 * Response: `{ data: { daysList, slots: { morning, afternoon, evening } } }`.
 */
export async function fetchVisionServiceSlots(
  params: FetchVisionServiceSlotsParams,
  init?: { skipGlobalLoading?: boolean },
): Promise<VisionServiceSlotsData> {
  const q = [
    `location=${encodeLocationQueryParam(params.location.trim())}`,
    `service=${encodeURIComponent(params.service)}`,
    `network_id=${encodeURIComponent(params.networkId.trim())}`,
  ].join("&");
  const raw = await patientJson<unknown>(`service/slots?${q}`, {
    method: "GET",
    skipGlobalLoading: init?.skipGlobalLoading,
  });
  const parsed = parseSlotsPayload(raw);
  if (!parsed) {
    throw new Error("Unexpected slots response");
  }
  return parsed;
}
