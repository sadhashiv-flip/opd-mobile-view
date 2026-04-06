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

