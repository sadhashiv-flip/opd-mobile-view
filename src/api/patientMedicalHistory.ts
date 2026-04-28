import { patientJson } from "@/api/patientHttp";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Extract list rows from `/patient/history/type/*` payloads (`results` or `data.results`). */
export function unwrapHistoryResults(root: unknown): unknown[] {
  const r = asRecord(root);
  if (!r) return [];
  const direct = r.results;
  if (Array.isArray(direct)) return direct;
  const data = asRecord(r.data);
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * `GET /patient/history/type/{apiSegment}?user_id=` — same as Flutter `MedicalRecordsRepository`.
 */
export async function fetchMedicalHistoryByType(
  apiSegment: string,
  opts?: { userId?: string | null },
): Promise<unknown[]> {
  const seg = apiSegment.trim().replace(/^\/+|\/+$/g, "");
  if (!seg) return [];
  const q = new URLSearchParams();
  const uid = opts?.userId?.trim();
  if (uid) {
    q.set("user_id", uid);
  }
  const qs = q.toString();
  const path = qs ? `history/type/${seg}?${qs}` : `history/type/${seg}`;
  const raw = await patientJson<unknown>(path, { method: "GET" });
  return unwrapHistoryResults(raw);
}
