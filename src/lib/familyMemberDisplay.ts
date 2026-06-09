import type { MemberDisplay } from "@/api/patientMember";
import { MEMBER_NOT_ACTIVATED_LABEL } from "@/lib/gymMemberDisplay";

export function formatFamilyRelationshipLabel(
  relationship: string | null | undefined,
  emptyFallback = "Member",
): string {
  const raw = (relationship ?? "").trim();
  if (!raw) return emptyFallback;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function buildFamilyMemberListSubtitle(member: MemberDisplay): string {
  const parts: string[] = [];
  parts.push(formatFamilyRelationshipLabel(member.relationship));
  if (member.age > 0) parts.push(`${member.age} yrs`);
  const gender = member.gender?.trim();
  if (gender) parts.push(gender);
  if (!member.isSubscribed) parts.push(MEMBER_NOT_ACTIVATED_LABEL);
  return parts.join(" · ");
}

export function memberShowsFamilyActivateCta(member: MemberDisplay): boolean {
  return !member.isSubscribed && member.canActivate;
}

export function dashIfEmpty(value: string | null | undefined): string {
  const t = value?.trim() ?? "";
  return t.length ? t : "—";
}

export function buildFamilyMemberAgeGenderLine(member: MemberDisplay): string {
  const parts: string[] = [];
  if (member.age > 0) parts.push(`${member.age} years`);
  const gender = member.gender?.trim();
  if (gender) parts.push(gender);
  if (parts.length === 0) return "—";
  return parts.join(" · ");
}

export function memberInitial(name: string): string {
  const t = name.trim();
  return t.length ? t.charAt(0).toUpperCase() : "?";
}
