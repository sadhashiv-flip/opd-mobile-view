import type { GymCheckData } from "@/api/patientGym";
import type { GymMemberListRow } from "@/lib/gymMemberDisplay";

/** Legacy single-id key — first selected id is mirrored here for compatibility. */
export const GYM_SELECTED_PERSON_KEY = "opd-mobile-view.gym-membership.selectedPersonId";

/** Ordered member ids from multi-select (JSON string array). */
export const GYM_SELECTED_PERSON_IDS_KEY = "opd-mobile-view.gym-membership.selectedPersonIds";

/** Session payload: `{ members: [...] }` or legacy single member object. */
export const GYM_SELECTED_MEMBER_SNAPSHOT_KEY = "opd-mobile-view.gym-membership.selected-member";

export type GymSelectedMemberSnapshot = Readonly<{
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  dob: string;
  city: string;
  relation?: string;
  /** From member list: order overlay only when `"self"`. */
  sourceSection?: "self" | "family";
}>;

function parseOneSnapshot(o: Record<string, unknown>): GymSelectedMemberSnapshot | null {
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const relation = o.relation;
  const sec = o.sourceSection;
  return {
    id: o.id,
    name: o.name,
    phone: typeof o.phone === "string" ? o.phone : "",
    email: typeof o.email === "string" ? o.email : "",
    gender: typeof o.gender === "string" ? o.gender : "",
    dob: typeof o.dob === "string" ? o.dob : "",
    city: typeof o.city === "string" ? o.city : "",
    relation: typeof relation === "string" && relation.trim() ? relation.trim() : undefined,
    sourceSection: sec === "self" || sec === "family" ? sec : undefined,
  };
}

export function buildGymMemberSnapshotFromRow(
  row: GymMemberListRow,
  gymCheck: GymCheckData | null,
): GymSelectedMemberSnapshot {
  const info = gymCheck?.order?.details?.info;
  const loc = gymCheck?.order?.details?.location?.trim() ?? "";

  let name = row.name.trim();
  let phone = row.phone?.trim() ?? "";
  let email = row.email?.trim() ?? "";

  const mergeOrder = row.section === "self";
  if (mergeOrder && info?.name?.trim()) {
    name = info.name.trim();
  }
  if (mergeOrder && info?.phone?.trim()) {
    phone = info.phone.trim() || phone;
  }
  if (mergeOrder && info?.email?.trim() && info.email !== "N/A") {
    email = info.email.trim();
  }

  return {
    id: row.id,
    name,
    phone,
    email,
    gender: row.gender?.trim() ?? "",
    dob: row.dob?.trim() ?? "",
    city: loc,
    relation: row.subtitle?.trim() || undefined,
    sourceSection: row.section,
  };
}

/** Ordered ids from localStorage; migrates legacy single {@link GYM_SELECTED_PERSON_KEY}. */
export function readGymSelectedPersonIds(): string[] {
  try {
    const multi = localStorage.getItem(GYM_SELECTED_PERSON_IDS_KEY);
    if (multi) {
      const parsed = JSON.parse(multi) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === "string")) {
        return parsed as string[];
      }
    }
    const legacy = localStorage.getItem(GYM_SELECTED_PERSON_KEY);
    if (legacy && legacy.length > 0) {
      return [legacy];
    }
  } catch {
    // ignore
  }
  return [];
}

export function writeGymSelectedPersonIds(ids: string[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(GYM_SELECTED_PERSON_IDS_KEY);
      localStorage.removeItem(GYM_SELECTED_PERSON_KEY);
      return;
    }
    localStorage.setItem(GYM_SELECTED_PERSON_IDS_KEY, JSON.stringify(ids));
    localStorage.setItem(GYM_SELECTED_PERSON_KEY, ids[0] ?? "");
  } catch {
    // ignore
  }
}

export function readGymSelectedMembersSnapshots(): GymSelectedMemberSnapshot[] {
  try {
    const raw = sessionStorage.getItem(GYM_SELECTED_MEMBER_SNAPSHOT_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return [];
    const root = p as Record<string, unknown>;
    if (Array.isArray(root.members)) {
      const out: GymSelectedMemberSnapshot[] = [];
      for (const item of root.members) {
        if (item && typeof item === "object") {
          const one = parseOneSnapshot(item as Record<string, unknown>);
          if (one) out.push(one);
        }
      }
      return out;
    }
    const one = parseOneSnapshot(root);
    return one ? [one] : [];
  } catch {
    return [];
  }
}

export function writeGymSelectedMembersSnapshots(members: GymSelectedMemberSnapshot[]): void {
  try {
    sessionStorage.setItem(GYM_SELECTED_MEMBER_SNAPSHOT_KEY, JSON.stringify({ members }));
  } catch {
    // ignore
  }
}

/** Writes a single selection (same as multi with one entry). */
export function writeGymSelectedMemberSnapshot(data: GymSelectedMemberSnapshot): void {
  writeGymSelectedMembersSnapshots([data]);
  writeGymSelectedPersonIds([data.id]);
}

/** First selected member, if any (legacy callers). */
export function readGymSelectedMemberSnapshot(): GymSelectedMemberSnapshot | null {
  const all = readGymSelectedMembersSnapshots();
  return all[0] ?? null;
}

export function clearGymSelectedMemberSnapshot(): void {
  try {
    sessionStorage.removeItem(GYM_SELECTED_MEMBER_SNAPSHOT_KEY);
    localStorage.removeItem(GYM_SELECTED_PERSON_IDS_KEY);
    localStorage.removeItem(GYM_SELECTED_PERSON_KEY);
  } catch {
    // ignore
  }
}

/** Keep snapshot from select-people; only fill empty fields from gym check order. */
export function enrichGymMemberSnapshot(
  snap: GymSelectedMemberSnapshot,
  gymCheck: GymCheckData | null,
): GymSelectedMemberSnapshot {
  const info = gymCheck?.order?.details?.info;
  const loc = gymCheck?.order?.details?.location?.trim() ?? "";

  let name = snap.name.trim();
  let phone = snap.phone.trim();
  let email = snap.email.trim();
  let city = snap.city.trim();

  const mergeOrder = snap.sourceSection === "self";
  if (mergeOrder) {
    if (!name && info?.name?.trim()) {
      name = info.name.trim();
    }
    if (!phone && info?.phone?.trim()) {
      phone = info.phone.trim();
    }
    if (!email && info?.email?.trim() && info.email !== "N/A") {
      email = info.email.trim();
    }
  }
  if (!city && loc) {
    city = loc;
  }

  return {
    ...snap,
    name,
    phone,
    email,
    city,
  };
}
