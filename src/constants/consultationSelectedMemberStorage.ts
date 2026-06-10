import type { GymMemberListRow } from "@/lib/gymMemberDisplay";

export const CONSULT_SELECTED_PERSON_KEY = "opd-mobile-view.consultation.selectedPersonId";
export const CONSULT_SELECTED_PERSON_IDS_KEY = "opd-mobile-view.consultation.selectedPersonIds";

export const CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY = "opd-mobile-view.consultation.selected-member";

export type ConsultationSelectedMemberSnapshot = Readonly<{
  id: string;
  /** Numeric patient id for booking APIs when distinct from {@link id}. */
  userId?: number | null;
  language?: string;
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
    userId: row.userId,
    language: row.language?.trim() || undefined,
    name: row.name.trim(),
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() ?? "",
    gender: row.gender?.trim() ?? "",
    dob: row.dob?.trim() ?? "",
    relation: row.subtitle?.trim() || undefined,
    sourceSection: row.section,
  };
}

/** `patient_id` / `user_id` for network + book APIs (patient_app `MemberController.selectedUserId`). */
export function resolveConsultBookingPersonId(row: GymMemberListRow): string {
  if (row.userId != null && Number.isFinite(row.userId)) {
    return String(row.userId);
  }
  return row.id;
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

export function writeConsultSelectedPersonIds(
  ids: string[],
  options?: Readonly<{ bookingPersonId?: string }>,
): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(CONSULT_SELECTED_PERSON_IDS_KEY);
      localStorage.removeItem(CONSULT_SELECTED_PERSON_KEY);
      return;
    }
    localStorage.setItem(CONSULT_SELECTED_PERSON_IDS_KEY, JSON.stringify(ids));
    const legacy =
      options?.bookingPersonId?.trim() || ids[0]?.trim() || "";
    if (legacy) {
      localStorage.setItem(CONSULT_SELECTED_PERSON_KEY, legacy);
    }
  } catch {
    // ignore
  }
}

/** Persist list-row id (UI) + booking id (API) + session snapshot. */
export function persistConsultSelectedMember(row: GymMemberListRow): void {
  writeConsultSelectedPersonIds([row.id], {
    bookingPersonId: resolveConsultBookingPersonId(row),
  });
  writeConsultSelectedMembersSnapshots([buildConsultMemberSnapshotFromRow(row)]);
}

export function writeConsultSelectedMembersSnapshots(members: ConsultationSelectedMemberSnapshot[]): void {
  try {
    sessionStorage.setItem(CONSULT_SELECTED_MEMBER_SNAPSHOT_KEY, JSON.stringify({ members }));
  } catch {
    // ignore
  }
}

/** Primary booking id — `user_id` on network list/slots (numeric when API provides it). */
export function readConsultSelectedPersonId(): string | null {
  try {
    const legacy = localStorage.getItem(CONSULT_SELECTED_PERSON_KEY)?.trim();
    if (legacy) return legacy;
  } catch {
    // ignore
  }
  const snap = readPrimaryConsultSelectedMemberSnapshot();
  if (snap?.userId != null && Number.isFinite(snap.userId)) {
    return String(snap.userId);
  }
  const ids = readConsultSelectedPersonIds();
  const id = ids[0]?.trim();
  return id || null;
}

/** Primary selected member id for booking APIs (`patient_id`). */
export function readConsultSelectedPersonIdNumber(): number | null {
  const fromStr = readConsultSelectedPersonId();
  if (fromStr) {
    const n = Number(fromStr);
    if (Number.isFinite(n)) return n;
  }
  const snap = readPrimaryConsultSelectedMemberSnapshot();
  if (snap?.userId != null && Number.isFinite(snap.userId)) return snap.userId;
  return null;
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

