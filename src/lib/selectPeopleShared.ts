import type { GymMemberListRow } from "@/lib/gymMemberDisplay";
import {
  DIAGNOSTICS_CHILD_AGE_BLOCK_REASON,
  MEMBER_NOT_ACTIVATED_LABEL,
} from "@/lib/gymMemberDisplay";

/** patient_app `AppString` — diagnostics / common member picker copy. */
export const SELECT_PEOPLE_COPY = {
  healthCheckupsTitle: "Health Checkups",
  labTestsTitle: "Lab Tests",
  noAhcEligibleMembers: "No members are eligible for the sponsored health checkup yet.",
  sponsoredByCompany: "Sponsored by your company",
  hintSponsoredEligible: "Sponsored checkup is available for eligible members.",
  hintSponsoredRestrict: "Select eligible members for sponsored health checkup.",
  hintSingleMember: "Select the family member for the service.",
  addAddressToContinue: "Add address to continue",
  addAddressAndSelectMembers: "Add an address and select members",
  selectMemberToContinue: "Select member to continue",
  selectHospitalLocationToContinue: "Select hospital location to continue",
} as const;

export type SelectPeopleHint = Readonly<{ sponsored: boolean; text: string }>;

export function parseBoolSearchParam(sp: URLSearchParams, key: string): boolean {
  const v = sp.get(key)?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function memberRowSubtitle(
  member: GymMemberListRow,
  opts: Readonly<{ showAhcSponsorSubtitle: boolean }>,
): string {
  if (member.isChildBlocked) return DIAGNOSTICS_CHILD_AGE_BLOCK_REASON;
  if (!member.isSubscribed) return MEMBER_NOT_ACTIVATED_LABEL;
  if (opts.showAhcSponsorSubtitle && member.ahcAvailable) {
    return SELECT_PEOPLE_COPY.sponsoredByCompany;
  }
  return member.subtitle;
}

export function diagnosticsSelectionHint(
  opts: Readonly<{
    filterAhcEligibleOnly: boolean;
    restrictToAhcSelection: boolean;
    showAhcSponsorSubtitle: boolean;
  }>,
): SelectPeopleHint {
  const sponsoredMode =
    opts.filterAhcEligibleOnly ||
    opts.restrictToAhcSelection ||
    opts.showAhcSponsorSubtitle;
  if (!sponsoredMode) {
    return { sponsored: false, text: SELECT_PEOPLE_COPY.hintSingleMember };
  }
  if (opts.restrictToAhcSelection) {
    return { sponsored: true, text: SELECT_PEOPLE_COPY.hintSponsoredRestrict };
  }
  return { sponsored: true, text: SELECT_PEOPLE_COPY.hintSponsoredEligible };
}

export function defaultSingleSelectHint(): SelectPeopleHint {
  return { sponsored: false, text: SELECT_PEOPLE_COPY.hintSingleMember };
}
