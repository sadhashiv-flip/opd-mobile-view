import type { GymMemberListRow } from "@/lib/gymMemberDisplay";

export const CONSULT_SELECTED_PERSON_KEY = "opd-mobile-view.consultation.selectedPersonId";
export const CONSULT_SELECTED_PERSON_IDS_KEY = "opd-mobile-view.consultation.selectedPersonIds";

export const CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY = "opd-mobile-view.consultation.selected-member";

export type ConsultationSelectedMemberSnapshot = Readonly<{
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  dob: string;
  relation?: string;
  sourceSection?: "self" | "family";
}>;

export function buildConsultMemberSnapshotFromRow(row: GymMemberListRow): ConsultationSelectedMemberSnapshot {
  return {
    id: row.id,
    name: row.name.trim(),
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() ?? "",
    gender: row.gender?.trim() ?? "",
    dob: row.dob?.trim() ?? "",
    relation: row.subtitle?.trim() || undefined,
    sourceSection: row.section,
  };
}

/** Ordered ids from localStorage; migrates legacy single {@link CONSULT_SELECTED_PERSON_KEY}. */
export function readConsultSelectedPersonIds(): string[] {
  try {
    const multi = localStorage.getItem(CONSULT_SELECTED_PERSON_IDS_KEY);
    if (multi) {
      const parsed = JSON.parse(multi) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === "string")) {
        return parsed as string[];
      }
    }
    const legacy = localStorage.getItem(CONSULT_SELECTED_PERSON_KEY);
    if (legacy?.trim()) return [legacy.trim()];
  } catch {
    // ignore
  }
  return [];
}

export function writeConsultSelectedPersonIds(ids: string[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(CONSULT_SELECTED_PERSON_IDS_KEY);
      localStorage.removeItem(CONSULT_SELECTED_PERSON_KEY);
      return;
    }
    localStorage.setItem(CONSULT_SELECTED_PERSON_IDS_KEY, JSON.stringify(ids));
    localStorage.setItem(CONSULT_SELECTED_PERSON_KEY, ids[0] ?? "");
  } catch {
    // ignore
  }
}

export function writeConsultSelectedMembersSnapshots(members: ConsultationSelectedMemberSnapshot[]): void {
  try {
    sessionStorage.setItem(CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY, JSON.stringify({ members }));
  } catch {
    // ignore
  }
}

/** Primary selected member id for booking APIs (`patient_id`). */
export function readConsultSelectedPersonIdNumber(): number | null {
  try {
    const raw = localStorage.getItem(CONSULT_SELECTED_PERSON_KEY);
    if (!raw?.trim()) return null;
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** First selected member from the select-people flow (session). */
export function readPrimaryConsultSelectedMemberSnapshot(): ConsultationSelectedMemberSnapshot | null {
  try {
    const raw = sessionStorage.getItem(CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const members = (parsed as { members?: ConsultationSelectedMemberSnapshot[] }).members;
    const m = Array.isArray(members) ? members[0] : null;
    return m && typeof m.name === "string" ? m : null;
  } catch {
    return null;
  }
}

