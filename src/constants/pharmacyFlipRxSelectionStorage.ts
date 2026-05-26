const KEY = "opd-mobile-view.pharmacy.flipRxSelection.v1";

type StoredSelection = Readonly<{
  patientId: number;
  keys: readonly string[];
}>;

function safeParse(raw: string | null): StoredSelection | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const patientId =
      typeof o.patientId === "number"
        ? o.patientId
        : typeof o.patientId === "string"
          ? Number(o.patientId)
          : NaN;
    if (!Number.isFinite(patientId)) return null;
    const keysRaw = o.keys;
    if (!Array.isArray(keysRaw)) return null;
    const keys = keysRaw.filter((k): k is string => typeof k === "string" && k.length > 0);
    return { patientId, keys };
  } catch {
    return null;
  }
}

export function readPharmacyFlipRxSelection(patientId: number): ReadonlySet<string> {
  const stored = safeParse(sessionStorage.getItem(KEY));
  if (!stored || stored.patientId !== patientId) return new Set();
  return new Set(stored.keys);
}

export function writePharmacyFlipRxSelection(patientId: number, keys: Iterable<string>): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ patientId, keys: [...keys] } satisfies StoredSelection),
    );
  } catch {
    // ignore
  }
}

export function clearPharmacyFlipRxSelection(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
