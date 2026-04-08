const KEY = "opd-mobile-view.vaccination.flow.v1";

export type VaccinationFlowState = Readonly<{
  memberId: string;
  memberName: string;
  /** `POST .../request` payload `user_id` — selected member’s numeric user id. */
  userId: number;
  selectedServices: ReadonlyArray<{ id: number; name: string }>;
  /** API format e.g. `2026-04-08 18:30:00` */
  preferredDateTime: string;
}>;

function safeParse(raw: string | null): VaccinationFlowState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const memberId = typeof o.memberId === "string" ? o.memberId : "";
    const memberName = typeof o.memberName === "string" ? o.memberName : "";
    const userIdRaw = o.userId;
    const userId =
      typeof userIdRaw === "number" && Number.isFinite(userIdRaw)
        ? userIdRaw
        : typeof userIdRaw === "string"
          ? Number(userIdRaw)
          : NaN;
    const preferredDateTime =
      typeof o.preferredDateTime === "string" ? o.preferredDateTime : "";
    const sel = o.selectedServices;
    const selectedServices: { id: number; name: string }[] = [];
    if (Array.isArray(sel)) {
      for (const row of sel) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const id = typeof r.id === "number" ? r.id : Number(r.id);
        const name = typeof r.name === "string" ? r.name : "";
        if (Number.isFinite(id) && name) selectedServices.push({ id, name });
      }
    }
    if (!memberId || !memberName || !Number.isFinite(userId)) return null;
    return {
      memberId,
      memberName,
      userId,
      selectedServices,
      preferredDateTime,
    };
  } catch {
    return null;
  }
}

export function readVaccinationFlowState(): VaccinationFlowState | null {
  try {
    return safeParse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writeVaccinationFlowState(next: VaccinationFlowState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearVaccinationFlowState(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
