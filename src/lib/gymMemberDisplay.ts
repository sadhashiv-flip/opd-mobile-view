import type { MemberDisplay } from "@/api/patientMember";

/** Shown on member rows when {@link GymMemberListRow.isSubscribed} is false. */
export const MEMBER_NOT_ACTIVATED_LABEL = "Not activated";

/** CTA when a plan allows activation — user completes assignment on Subscriptions. */
export const MEMBER_SUBSCRIPTION_ACTIVATE_LABEL = "Activate";

/** Native `title` on the “Add” pill for subscribed members (tap row to select). */
export const HC_PERSON_ADD_CTA_TOOLTIP =
  "Choose this person for your booking. Tap the row or this label.";

/** When “Add” is dimmed (e.g. incompatible health-checkup mix or other row rules). */
export const HC_PERSON_ADD_CTA_DISABLED_TOOLTIP =
  "This member can’t be selected with your current choices. Change or clear your selection and try again.";

/** Gym multi-select when the member cap is reached. */
export const HC_PERSON_ADD_GYM_MAX_TOOLTIP =
  "You’ve selected the maximum members for this step. Remove one to pick someone else.";

/** When the trailing label is “Not activated” (no subscription-activate path). */
export const HC_PERSON_NOT_ACTIVATED_CTA_TOOLTIP =
  "This profile isn’t active on your plan for this service yet. Pick an active member or complete setup in Subscriptions.";

/** Hover / long-press hint on the subscription activation shortcut. */
export const HC_PERSON_ACTIVATE_CTA_TOOLTIP =
  "Your plan has open member slots. Opens Subscriptions so you can assign this person to the plan.";

/** patient_app `FamilyMember.isChildBlocked` — blocks member pickers when age is 1–7. */
export const DIAGNOSTICS_CHILD_AGE_BLOCK_REASON = "Not eligible (age 7 or below)";

export function isDiagnosticsChildBlocked(age: number): boolean {
  return age > 0 && age <= 7;
}

export function memberShowsSubscriptionActivateCta(row: GymMemberListRow): boolean {
  return !row.isSubscribed && row.subscriptionCanActivate;
}

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
  /** Member age when known (API or derived from DOB). */
  age: number;
  /** True when age is 1–7 — no gate on dental; shown/selectable on other services. */
  isChildBlocked: boolean;
  /** Sponsored AHC eligibility from members API (`AHCAvailable`). */
  ahcAvailable: boolean;
  /** From members API `isSubscribed` — false means plan not active for this member. */
  isSubscribed: boolean;
  /**
   * When true (from active subscription `canActivate`), inactive rows show an Activate control
   * instead of "Not activated".
   */
  subscriptionCanActivate: boolean;
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

export type PatientMembersToGymRowsOpts = Readonly<{
  subscriptionCanActivate?: boolean;
}>;

export function patientMembersToGymRows(
  members: readonly MemberDisplay[],
  opts?: PatientMembersToGymRowsOpts,
): GymMemberListRow[] {
  const subscriptionCanActivate = opts?.subscriptionCanActivate === true;
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
    age: m.age,
    isChildBlocked: isDiagnosticsChildBlocked(m.age),
    ahcAvailable: m.ahcAvailable,
    isSubscribed: m.isSubscribed,
    subscriptionCanActivate,
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
