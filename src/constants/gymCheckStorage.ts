import type { GymCheckData } from "@/api/patientGym";

export const GYM_CHECK_SNAPSHOT_KEY = "opd-mobile-view.gym-membership.check-snapshot";

export function readGymCheckSnapshot(): GymCheckData | null {
  try {
    const raw = sessionStorage.getItem(GYM_CHECK_SNAPSHOT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    return p as GymCheckData;
  } catch {
    return null;
  }
}

export function writeGymCheckSnapshot(data: GymCheckData): void {
  try {
    sessionStorage.setItem(GYM_CHECK_SNAPSHOT_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
