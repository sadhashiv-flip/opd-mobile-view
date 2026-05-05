import type { MemberDisplay } from "@/api/patientMember";

/** Shown on member rows when {@link GymMemberListRow.isSubscribed} is false. */
export const MEMBER_NOT_ACTIVATED_LABEL = "Not activated";

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
  /** Sponsored AHC eligibility from members API (`AHCAvailable`). */
  ahcAvailable: boolean;
  /** From members API `isSubscribed` — false means plan not active for this member. */
  isSubscribed: boolean;
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
    ahcAvailable: m.ahcAvailable,
    isSubscribed: m.isSubscribed,
  }));
}

/** Prefer primary among subscribed members, else first subscribed row; empty if none are active. */
export function defaultGymMemberSelection(rows: readonly GymMemberListRow[]): string[] {
  const active = rows.filter((r) => r.isSubscribed);
  if (active.length === 0) return [];
  const primary = active.find((r) => r.section === "self");
  if (primary) return [primary.id];
  return active[0] ? [active[0].id] : [];
}
