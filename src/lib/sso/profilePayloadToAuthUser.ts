import type { AuthUser } from "@/types/authSession";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return "";
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length ? s : null;
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
}

function coerceBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === "true" || v === 1) return true;
  if (v === false || v === "false" || v === 0) return false;
  return fallback;
}

/**
 * Same user extraction as {@link normalizeProfileResponse} — verify/profile payloads may nest
 * `user`, `profile`, `data`, or be flat.
 */
function pickUserRecord(body: unknown): Record<string, unknown> {
  const root = asRecord(body) ?? {};
  return (
    asRecord(root.user) ??
    asRecord(root.profile) ??
    asRecord(root.data) ??
    asRecord(root.patient) ??
    root
  );
}

/**
 * Maps GET `/patient/profile` (or verify-shaped) JSON into {@link AuthUser} for session storage.
 */
export function mapProfileBodyToAuthUser(body: unknown): AuthUser {
  const pick = pickUserRecord(body);
  const first = str(pick.first_name);
  const last = str(pick.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  const name = str(pick.name) || combined || "Member";
  const now = new Date().toISOString();

  const id = coerceNumber(pick.id);
  if (id == null) {
    throw new Error("Profile response is missing a numeric user id");
  }

  const age = coerceNumber(pick.age);

  return {
    name,
    email: strOrNull(pick.email),
    phone: str(pick.phone) || "",
    dob: strOrNull(pick.dob),
    image: strOrNull(pick.image) ?? strOrNull(pick.avatar) ?? strOrNull(pick.photo),
    gender: strOrNull(pick.gender),
    isBloodPressure: strOrNull(pick.isBloodPressure) ?? strOrNull(pick.is_blood_pressure),
    isDiabetic: strOrNull(pick.isDiabetic) ?? strOrNull(pick.is_diabetic),
    bloodGroup: strOrNull(pick.bloodGroup) ?? strOrNull(pick.blood_group),
    occupation: strOrNull(pick.occupation),
    isChronic: strOrNull(pick.isChronic) ?? strOrNull(pick.is_chronic),
    language: strOrNull(pick.language),
    vip: coerceBool(pick.vip, false),
    empId: strOrNull(pick.empId) ?? strOrNull(pick.emp_id),
    device_id: strOrNull(pick.device_id),
    platform: strOrNull(pick.platform),
    ref_code: strOrNull(pick.ref_code),
    ref_by: strOrNull(pick.ref_by),
    relationship: strOrNull(pick.relationship),
    jm_user_id: strOrNull(pick.jm_user_id),
    md_user_id: strOrNull(pick.md_user_id),
    testAccount: coerceBool(pick.testAccount ?? pick.test_account, false),
    personal_account: coerceBool(pick.personal_account ?? pick.personalAccount, true),
    account_transferred_date:
      strOrNull(pick.account_transferred_date) ?? strOrNull(pick.accountTransferredDate),
    date_of_joining: strOrNull(pick.date_of_joining) ?? strOrNull(pick.dateOfJoining),
    hasPIN: coerceBool(pick.hasPIN ?? pick.has_pin, false),
    first_name: first || name.split(/\s+/)[0] || "Member",
    last_name: last || name.split(/\s+/).slice(1).join(" ") || "",
    age,
    hasPassword: coerceBool(pick.hasPassword ?? pick.has_password, false),
    id,
    type: str(pick.type) || "patient",
    primary: str(pick.primary) || "phone",
    freeConsultations: coerceNumber(pick.freeConsultations ?? pick.free_consultations) ?? 0,
    corporate_id: coerceNumber(pick.corporate_id ?? pick.corporateId),
    status: coerceNumber(pick.status) ?? 1,
    cugc: pick.cugc ?? null,
    cuid: pick.cuid ?? null,
    cdid: pick.cdid ?? null,
    createdAt: str(pick.createdAt) || str(pick.created_at) || now,
    updatedAt: str(pick.updatedAt) || str(pick.updated_at) || now,
  };
}

/** Registration complete — matches POST `/patient/verify` `isReg`. */
export function readIsRegFromProfileBody(body: unknown): boolean {
  const root = asRecord(body) ?? {};
  const pick = pickUserRecord(body);
  const v =
    pick.isReg ??
    pick.is_reg ??
    pick.registration_complete ??
    pick.registrationComplete ??
    root.isReg ??
    root.is_reg ??
    root.registration_complete ??
    root.registrationComplete;
  if (v === undefined) return true;
  return coerceBool(v, true);
}

/**
 * Account-link hint — matches POST `/patient/verify` `link`.
 * Also reads root-level `link` / `verify_link` (same shape as verify: `{ user, token, link, … }`).
 */
export function readLinkFromProfileBody(body: unknown): string {
  const root = asRecord(body) ?? {};
  const pick = pickUserRecord(body);
  const u =
    strOrNull(pick.link) ??
    strOrNull(pick.verify_link) ??
    strOrNull(root.link) ??
    strOrNull(root.verify_link);
  return u?.trim() ? u.trim() : "NONE";
}
