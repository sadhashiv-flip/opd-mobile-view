import type { MemberDisplay } from "@/api/patientMember";

/** Rows used by gym select-people and configure (aligned with former PersonCard / MemberRow). */
export type GymMemberListRow = Readonly<{
  id: string;
  name: string;
  subtitle: string;
  section: "self" | "family";
  /** Numeric id for booking payloads (`user_id`, patient id, etc.); null if unknown. */
  userId: number | null;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
}>;

function subtitleForMember(m: MemberDisplay): string {
  if (m.memberKind === "primary") {
    const r = m.relationship?.trim();
    if (r) return r;
    return "Primary account";
  }
  const r = m.relationship?.trim();
  if (r) return r;
  if (m.statusLabel?.trim()) return m.statusLabel;
  return "Family member";
}

export function patientMembersToGymRows(members: readonly MemberDisplay[]): GymMemberListRow[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    subtitle: subtitleForMember(m),
    section: m.memberKind === "primary" ? "self" : "family",
    userId: m.patientNumericId,
    phone: m.phone ?? undefined,
    email: m.email ?? undefined,
    dob: m.dob ?? undefined,
    gender: m.gender ?? undefined,
    bloodGroup: m.bloodGroup ?? undefined,
  }));
}
