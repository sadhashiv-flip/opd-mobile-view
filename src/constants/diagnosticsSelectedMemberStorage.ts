import type { GymMemberListRow } from "@/lib/gymMemberDisplay";

export const DIAG_SELECTED_PERSON_KEY = "opd-mobile-view.diagnostics.selectedPersonId";
export const DIAG_SELECTED_PERSON_IDS_KEY = "opd-mobile-view.diagnostics.selectedPersonIds";

export const DIAG_SELECTED_MEMBER_SNAPSHOT_KEY = "opd-mobile-view.diagnostics.selected-member";

export type DiagnosticsSelectedMemberSnapshot = Readonly<{
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  dob: string;
  relation?: string;
  sourceSection?: "self" | "family";
}>;

export function buildDiagnosticsMemberSnapshotFromRow(row: GymMemberListRow): DiagnosticsSelectedMemberSnapshot {
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

export function writeDiagnosticsSelectedPersonIds(ids: string[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(DIAG_SELECTED_PERSON_IDS_KEY);
      localStorage.removeItem(DIAG_SELECTED_PERSON_KEY);
      return;
    }
    localStorage.setItem(DIAG_SELECTED_PERSON_IDS_KEY, JSON.stringify(ids));
    localStorage.setItem(DIAG_SELECTED_PERSON_KEY, ids[0] ?? "");
  } catch {
    // ignore
  }
}

export function writeDiagnosticsSelectedMembersSnapshots(members: DiagnosticsSelectedMemberSnapshot[]): void {
  try {
    sessionStorage.setItem(DIAG_SELECTED_MEMBER_SNAPSHOT_KEY, JSON.stringify({ members }));
  } catch {
    // ignore
  }
}
