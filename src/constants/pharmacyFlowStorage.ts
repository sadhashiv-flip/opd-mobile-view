const KEY = "opd-mobile-view.pharmacy.flow.v1";

export type PharmacyFlowState = Readonly<{
  memberId: string;
  patientName: string;
  /** `POST /medicine` payload `patient_id`. */
  patientId: number;
}>;

function safeParse(raw: string | null): PharmacyFlowState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const memberId = typeof o.memberId === "string" ? o.memberId : "";
    const patientName = typeof o.patientName === "string" ? o.patientName : "";
    const pidRaw = o.patientId;
    const patientId =
      typeof pidRaw === "number" && Number.isFinite(pidRaw)
        ? pidRaw
        : typeof pidRaw === "string"
          ? Number(pidRaw)
          : NaN;
    if (!memberId || !patientName || !Number.isFinite(patientId)) return null;
    return { memberId, patientName, patientId };
  } catch {
    return null;
  }
}

export function readPharmacyFlowState(): PharmacyFlowState | null {
  try {
    return safeParse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writePharmacyFlowState(next: PharmacyFlowState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearPharmacyFlowState(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
