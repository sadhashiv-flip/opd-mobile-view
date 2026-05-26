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
  /** Numeric patient id for booking payloads (`POST /service/vision/request`, etc.). */
  userId?: number | null;
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
    userId: row.userId,
  };
}

/** Ordered ids from localStorage; migrates legacy single {@link DIAG_SELECTED_PERSON_KEY}. */
export function readDiagnosticsSelectedPersonIds(): string[] {
  try {
    const multi = localStorage.getItem(DIAG_SELECTED_PERSON_IDS_KEY);
    if (multi) {
      const parsed = JSON.parse(multi) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === "string")) {
        return parsed as string[];
      }
    }
    const legacy = localStorage.getItem(DIAG_SELECTED_PERSON_KEY);
    if (legacy?.trim()) return [legacy.trim()];
  } catch {
    // ignore
  }
  return [];
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

export function readDiagnosticsSelectedMembersSnapshots(): DiagnosticsSelectedMemberSnapshot[] {
  try {
    const raw = sessionStorage.getItem(DIAG_SELECTED_MEMBER_SNAPSHOT_KEY);
    if (!raw?.trim()) return [];
    const p = JSON.parse(raw) as { members?: unknown };
    const m = p.members;
    if (!Array.isArray(m)) return [];
    const out: DiagnosticsSelectedMemberSnapshot[] = [];
    for (const row of m) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      if (!id) continue;
      const uidRaw = r.userId ?? r.user_id;
      let userId: number | null | undefined;
      if (typeof uidRaw === "number" && Number.isFinite(uidRaw)) {
        userId = uidRaw;
      } else if (typeof uidRaw === "string" && uidRaw.trim() !== "") {
        const n = Number(uidRaw.trim());
        userId = Number.isFinite(n) ? n : undefined;
      }
      out.push({
        id,
        name: typeof r.name === "string" ? r.name : "",
        phone: typeof r.phone === "string" ? r.phone : "",
        email: typeof r.email === "string" ? r.email : "",
        gender: typeof r.gender === "string" ? r.gender : "",
        dob: typeof r.dob === "string" ? r.dob : "",
        relation: typeof r.relation === "string" ? r.relation : undefined,
        sourceSection: r.sourceSection === "self" || r.sourceSection === "family" ? r.sourceSection : undefined,
        ...(userId === undefined ? {} : { userId }),
      });
    }
    return out;
  } catch {
    return [];
  }
}
