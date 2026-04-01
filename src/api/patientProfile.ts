import { patientJson } from "@/api/patientHttp";

/** Normalized fields for the profile screen (API shape may vary). */
export type ProfileDisplay = Readonly<{
  name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  image: string | null;
  age: string | null;
  occupation: string | null;
  bloodGroup: string | null;
  language: string | null;
  empId: string | null;
  relationship: string | null;
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

function strAge(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return str(v);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Accepts `{ user }`, `{ profile }`, `{ data }`, or a flat user object.
 */
export function normalizeProfileResponse(body: unknown): ProfileDisplay {
  const root = asRecord(body) ?? {};
  const pickUser =
    asRecord(root.user) ??
    asRecord(root.profile) ??
    asRecord(root.data) ??
    (asRecord(root.patient) ?? root);

  const first = str(pickUser.first_name);
  const last = str(pickUser.last_name);
  const combinedName = [first, last].filter(Boolean).join(" ").trim();
  const name = str(pickUser.name) ?? (combinedName || "Member");

  return {
    name,
    email: str(pickUser.email),
    phone: str(pickUser.phone),
    dob: str(pickUser.dob),
    gender: str(pickUser.gender),
    image: str(pickUser.image) ?? str(pickUser.avatar) ?? str(pickUser.photo),
    age: strAge(pickUser.age),
    occupation: str(pickUser.occupation),
    bloodGroup: str(pickUser.bloodGroup),
    language: str(pickUser.language),
    empId: str(pickUser.empId),
    relationship: str(pickUser.relationship),
  };
}

function trimEnvUrl(raw: string | undefined): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\/$/, "");
}

/**
 * Profile `image` from API: absolute URLs unchanged; relative paths use
 * `VITE_IMAGE_URL` when set, else API origin from `VITE_API_BASE_URL`.
 */
export function resolveProfileImageUrl(image: string | null): string | null {
  if (!image?.trim()) return null;
  const t = image.trim();
  if (/^https?:\/\//i.test(t)) return t;

  const path = t.replace(/^\//, "");

  const imageBase = trimEnvUrl(import.meta.env.VITE_IMAGE_URL);
  if (imageBase) {
    return `${imageBase}/${path}`;
  }

  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== "string" || !raw.trim()) {
    return t.startsWith("/") ? t : `/${t}`;
  }
  const origin = raw.replace(/\/?patient\/?$/i, "").replace(/\/$/, "");
  return `${origin}/${path}`;
}

/** GET /patient/profile (Bearer token via interceptor). */
export async function fetchPatientProfile(): Promise<ProfileDisplay> {
  const raw = await patientJson<unknown>("profile", { method: "GET" });
  return normalizeProfileResponse(raw);
}
