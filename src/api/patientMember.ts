import { DEFAULT_LIST_PAGE_SIZE, fetchAllListPages, type ListPaginationOpts } from "@/api/listPagination";
import { patientFetchChecked, patientJsonList } from "@/api/patientHttp";

export type MemberDisplay = Readonly<{
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  /** Human-readable status from API (e.g. verified, pending) when present. */
  statusLabel: string | null;
  /** Primary account holder vs dependent, from id vs API primary id or row flags. */
  memberKind: "primary" | "dependent";
  height: string | null;
  weight: string | null;
  bloodGroup: string | null;
  language: string | null;
  isBloodPressure: "yes" | "no" | null;
  isDiabetic: "yes" | "no" | null;
  code: string | null;
}>;

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
    return null;
  }
  const s = String(v).trim();
  return s.length ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function extractMemberRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const keys = [root.data, root.members, root.items, root.results, root.records] as const;
  for (const k of keys) {
    if (Array.isArray(k)) return k;
    const inner = asRecord(k);
    if (inner) {
      const a = inner.data ?? inner.items ?? inner.members;
      if (Array.isArray(a)) return a;
    }
  }
  return [];
}

function extractPrimaryMemberId(body: unknown): string | null {
  const tryScalar = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") return str(v);
    const rec = asRecord(v);
    if (!rec) return null;
    return str(rec.id) ?? str(rec.member_id) ?? str(rec.uuid);
  };

  const scan = (r: Record<string, unknown> | null): string | null => {
    if (!r) return null;
    const keys = [
      "primary",
      "primary_id",
      "primary_member_id",
      "primaryMemberId",
      "primary_user_id",
      "primaryUserId",
    ] as const;
    for (const k of keys) {
      const found = tryScalar(r[k]);
      if (found) return found;
    }
    return null;
  };

  const root = asRecord(body);
  if (!root) return null;
  const fromRoot = scan(root);
  if (fromRoot) return fromRoot;
  return scan(asRecord(root.data));
}

function deriveMemberKind(
  o: Record<string, unknown>,
  memberId: string,
  primaryMemberId: string | null,
): "primary" | "dependent" {
  if (primaryMemberId && memberId === primaryMemberId) return "primary";

  const rowPrimaryRef =
    str(o.primary) ?? str(o.primary_id) ?? str(o.primary_member_id) ?? str(o.primaryMemberId);
  if (rowPrimaryRef && memberId === rowPrimaryRef) return "primary";

  if (o.primary === true || o.primary === 1) return "primary";

  if (
    o.is_primary === true ||
    o.is_primary === 1 ||
    o.isPrimary === true ||
    coerceFiniteNumber(o.is_primary) === 1
  ) {
    return "primary";
  }

  if (memberId.toLowerCase() === "primary") return "primary";
  return "dependent";
}

function normalizeYesNo(v: unknown): "yes" | "no" | null {
  const s = str(v)?.toLowerCase();
  if (s === "yes" || s === "y" || s === "1" || s === "true") return "yes";
  if (s === "no" || s === "n" || s === "0" || s === "false") return "no";
  return null;
}

function coerceFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
}

function healthScoreDetailsRow(o: Record<string, unknown>): Record<string, unknown> | null {
  const hs = asRecord(o.health_score) ?? asRecord(o.healthScore);
  if (!hs) return null;
  return asRecord(hs.details);
}

function deriveStatusLabel(o: Record<string, unknown>): string | null {
  const statusFlag = coerceFiniteNumber(o.status);
  if (statusFlag === 1) return "Active";
  if (statusFlag === 0) return "Inactive";

  const explicit =
    str(o.status) ??
    str(o.member_status) ??
    str(o.verification_status) ??
    str(o.memberStatus) ??
    str(o.verificationStatus);
  if (explicit) return explicit;
  let n: number | null = null;
  if (typeof o.verify_status === "number") n = o.verify_status;
  else if (typeof o.is_verified === "number") n = o.is_verified;
  if (n === 1) return "Verified";
  if (n === 0) return "Pending";
  const active = o.active;
  if (active === true || str(o.active) === "1") return "Active";
  if (active === false || str(o.active) === "0") return "Inactive";
  return null;
}

function normalizeMember(
  v: unknown,
  index: number,
  primaryMemberId: string | null,
): MemberDisplay | null {
  const o = asRecord(v);
  if (!o) return null;
  const id =
    str(o.id) ??
    str(o.member_id) ??
    str(o.uuid) ??
    `member-${index}`;
  const name = str(o.name) ?? str(o.full_name) ?? str(o.fullName);
  if (!name) return null;
  const hsd = healthScoreDetailsRow(o);
  const heightFromHealth = hsd ? str(hsd.height) : null;
  const weightFromHealth = hsd ? str(hsd.weight) : null;
  return {
    id,
    name,
    relationship: str(o.relationship) ?? str(o.relation),
    phone: str(o.phone) ?? str(o.mobile) ?? str(o.phone_number),
    dob: str(o.dob) ?? str(o.date_of_birth) ?? str(o.dateOfBirth),
    gender: str(o.gender) ?? str(o.sex),
    statusLabel: deriveStatusLabel(o),
    memberKind: deriveMemberKind(o, id, primaryMemberId),
    height:
      heightFromHealth ??
      str(o.height) ??
      str(o.height_cm) ??
      str(o.heightCm),
    weight:
      weightFromHealth ??
      str(o.weight) ??
      str(o.weight_kg) ??
      str(o.weightKg),
    bloodGroup: str(o.bloodGroup) ?? str(o.blood_group),
    language: str(o.language),
    isBloodPressure: normalizeYesNo(o.isBloodPressure ?? o.is_blood_pressure),
    isDiabetic: normalizeYesNo(o.isDiabetic ?? o.is_diabetic),
    code: str(o.code),
  };
}

/** GET `/member?page=&limit=` */
export async function fetchPatientMembers(
  pagination?: ListPaginationOpts,
): Promise<MemberDisplay[]> {
  const raw = await patientJsonList<unknown>("member", { method: "GET" }, pagination);
  const primaryMemberId = extractPrimaryMemberId(raw);
  return extractMemberRows(raw)
    .map((row, i) => normalizeMember(row, i, primaryMemberId))
    .filter((x): x is MemberDisplay => x != null);
}

/** Loads every page until a short or empty response. */
export async function fetchAllPatientMembers(): Promise<MemberDisplay[]> {
  return fetchAllListPages((opts) => fetchPatientMembers(opts));
}

/** POST/PATCH /member — matches backend JSON shape. */
export type SaveMemberPayload = Readonly<{
  name: string;
  relationship: string;
  dob: string;
  /** API expects lowercase, e.g. `female`. */
  gender: string;
  height: string;
  weight: string;
  isBloodPressure: "yes" | "no";
  isDiabetic: "yes" | "no";
  bloodGroup: string;
  language: string;
  phone: string | null;
  code: string | null;
}>;

function buildMemberJsonBody(payload: SaveMemberPayload): Record<string, unknown> {
  const phoneTrim = payload.phone?.trim() ?? "";
  const codeTrim = payload.code?.trim() ?? "";
  return {
    dob: payload.dob.trim() || null,
    gender: payload.gender.trim().toLowerCase(),
    height: payload.height.trim() || null,
    isBloodPressure: payload.isBloodPressure,
    bloodGroup: payload.bloodGroup.trim() || null,
    phone: phoneTrim.length ? phoneTrim : null,
    isDiabetic: payload.isDiabetic,
    language: payload.language.trim() || null,
    name: payload.name.trim(),
    weight: payload.weight.trim() || null,
    code: codeTrim.length ? codeTrim : null,
    relationship: payload.relationship.trim(),
  };
}

/** POST /patient/member */
export async function createPatientMember(payload: SaveMemberPayload): Promise<void> {
  const res = await patientFetchChecked("member", {
    method: "POST",
    body: JSON.stringify(buildMemberJsonBody(payload)),
  });
  await res.text();
}

/** PATCH /patient/member/:id */
export async function updatePatientMember(id: string, payload: SaveMemberPayload): Promise<void> {
  const res = await patientFetchChecked(`member/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(buildMemberJsonBody(payload)),
  });
  await res.text();
}

/** Resolve one member from paginated GET `member` (scans pages until found). */
export async function fetchPatientMemberById(id: string): Promise<MemberDisplay | null> {
  let page = 1;
  while (page < 200) {
    const list = await fetchPatientMembers({ page, limit: DEFAULT_LIST_PAGE_SIZE });
    const found = list.find((m) => m.id === id);
    if (found) return found;
    if (list.length === 0 || list.length < DEFAULT_LIST_PAGE_SIZE) break;
    page += 1;
  }
  return null;
}
