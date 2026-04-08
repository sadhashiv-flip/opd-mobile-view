import type { PharmacyMockPrescription } from "@/constants/pharmacyMockData";

const KEY = "opd-mobile-view.pharmacy.prescriptions.v2";

type CachePayload = Readonly<{
  patientId: number;
  items: readonly PharmacyMockPrescription[];
}>;

function safeParse(raw: string | null): CachePayload | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const patientId = typeof o.patientId === "number" && Number.isFinite(o.patientId) ? o.patientId : NaN;
    const items = o.items;
    if (!Number.isFinite(patientId) || !Array.isArray(items)) return null;
    return { patientId, items: items as PharmacyMockPrescription[] };
  } catch {
    return null;
  }
}

export function writePharmacyPrescriptionsCache(patientId: number, items: readonly PharmacyMockPrescription[]): void {
  try {
    const payload: CachePayload = { patientId, items };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readCachedPharmacyPrescription(
  patientId: number,
  prescriptionId: string,
): PharmacyMockPrescription | null {
  const id = prescriptionId.trim();
  if (!id) return null;
  try {
    const cur = safeParse(sessionStorage.getItem(KEY));
    if (!cur || cur.patientId !== patientId) return null;
    return cur.items.find((p) => p.prescriptionId === id) ?? null;
  } catch {
    return null;
  }
}
