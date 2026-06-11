import { patientFetchChecked, patientJson } from "@/api/patientHttp";
import { uploadProfileImageFileRaw } from "@/api/patientUpload";
import { loadCachedProfileRaw, saveCachedProfileRaw } from "@/lib/profileCacheStorage";
import { extractProfileRecord } from "@/lib/subscriptionDashboardModules";

/** WHO-style bands for BMI coloring on the profile screen. */
export type BmiCategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obese";

/** Normalized fields for the profile screen (API shape may vary). */
export type ProfileDisplay = Readonly<{
  name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  image: string | null;
  age: string | null;
  /**
   * Prefer `profile.health_score.value` when present; else other BMI fields or
   * computed from height/weight.
   */
  bmi: string | null;
  /** Derived from numeric BMI for UI color; null if unknown or out of range. */
  bmiCategory: BmiCategory | null;
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

/** Height in metres from `height` (m or cm) or `height_cm`. */
function heightMetersFromProfile(o: Record<string, unknown>): number | null {
  const cm = coerceNumber(o.height_cm) ?? coerceNumber(o.heightCm);
  if (cm != null && cm > 0) return cm / 100;
  const h = coerceNumber(o.height);
  if (h == null || h <= 0) return null;
  if (h > 30) return h / 100;
  if (h < 4) return h;
  return h / 100;
}

function computeBmiFromProfile(o: Record<string, unknown>): number | null {
  const w =
    coerceNumber(o.weight) ?? coerceNumber(o.weight_kg) ?? coerceNumber(o.weightKg);
  const hm = heightMetersFromProfile(o);
  if (w == null || hm == null || hm <= 0) return null;
  const bmi = w / (hm * hm);
  if (!Number.isFinite(bmi) || bmi < 10 || bmi > 65) return null;
  return bmi;
}

function normalizeBmiDisplay(o: Record<string, unknown>): string | null {
  const bmiIndex = coerceNumber(o.body_mass_index);
  const fromIndex = typeof bmiIndex === "number" ? String(bmiIndex) : null;
  const direct = str(o.bmi) ?? str(o.BMI) ?? fromIndex;
  if (direct) {
    const n = Number(direct.replace(",", "."));
    if (Number.isNaN(n) || !Number.isFinite(n)) return direct;
    return n.toFixed(1);
  }
  const computed = computeBmiFromProfile(o);
  if (computed == null) return null;
  return computed.toFixed(1);
}

function parseBmiStringToNumber(display: string | null): number | null {
  if (typeof display === "string" && display.length > 0) {
    const n = Number(display.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function bmiCategoryFromNumeric(bmi: number): BmiCategory | null {
  if (!Number.isFinite(bmi) || bmi < 10 || bmi > 65) return null;
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function resolveHealthScore(
  root: Record<string, unknown>,
  pickUser: Record<string, unknown>,
): Record<string, unknown> | null {
  return (
    asRecord(pickUser.health_score) ??
    asRecord(asRecord(root.profile)?.health_score) ??
    asRecord(asRecord(root.data)?.health_score) ??
    null
  );
}

function resolveBmiDisplayAndCategory(
  root: Record<string, unknown>,
  pickUser: Record<string, unknown>,
  pickForBmi: Record<string, unknown>,
): { bmi: string | null; bmiCategory: BmiCategory | null } {
  const healthScore = resolveHealthScore(root, pickUser);
  const fromScore = healthScore ? coerceNumber(healthScore.value) : null;
  if (fromScore != null && Number.isFinite(fromScore)) {
    const formatted = fromScore.toFixed(1);
    return {
      bmi: formatted,
      bmiCategory: bmiCategoryFromNumeric(fromScore),
    };
  }

  const fallback = normalizeBmiDisplay(pickForBmi);
  const n = parseBmiStringToNumber(fallback);
  const categoryFromFallback =
    typeof n === "number" ? bmiCategoryFromNumeric(n) : null;
  return {
    bmi: fallback,
    bmiCategory: categoryFromFallback,
  };
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

  const first = str(pickUser.first_name) ?? str(pickUser.firstName);
  const last = str(pickUser.last_name) ?? str(pickUser.lastName);
  const combinedName = [first, last].filter(Boolean).join(" ").trim();
  const name = str(pickUser.name) ?? (combinedName || "Member");

  const health = asRecord(pickUser.health) ?? asRecord(pickUser.health_score);
  const healthDetails = health ? asRecord(health.details) : null;
  const pickForBmi = healthDetails ? { ...pickUser, ...healthDetails } : pickUser;

  const { bmi, bmiCategory } = resolveBmiDisplayAndCategory(
    root,
    pickUser,
    pickForBmi,
  );

  return {
    name,
    email: str(pickUser.email),
    phone: str(pickUser.phone),
    dob: str(pickUser.dob),
    gender: str(pickUser.gender),
    image:
      str(pickUser.profileImage) ??
      str(pickUser.profile_image) ??
      str(pickUser.image) ??
      str(pickUser.avatar) ??
      str(pickUser.photo) ??
      str(root.profileImage) ??
      str(root.profile_image),
    age: strAge(pickUser.age),
    bmi,
    bmiCategory,
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
export type CompanyLogoDisplay = Readonly<{
  url: string | null;
  name: string | null;
}>;

/** patient-app `WalletScreen._buildPartnerLogo` — `user.company.image` from profile. */
export function resolveCompanyLogoFromProfile(body: unknown): CompanyLogoDisplay {
  const root = asRecord(body);
  if (!root) return { url: null, name: null };

  const profile = extractProfileRecord(body);
  const company =
    asRecord(profile?.company) ??
    asRecord(root.company) ??
    asRecord(asRecord(root.user)?.company);

  if (!company) return { url: null, name: null };

  return {
    url: resolveProfileImageUrl(str(company.image)),
    name: str(company.name),
  };
}

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

function pickStrFromUpload(...candidates: readonly unknown[]): string | null {
  for (const v of candidates) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
  }
  return null;
}

/**
 * Reads a relative image path (or absolute URL) from a typical `POST /upload` JSON body
 * after a profile photo upload.
 */
export function extractProfileImagePathFromUploadResponse(body: unknown): string | null {
  const root =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (!root) return null;
  const data =
    root.data !== null && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const fileObj =
    data.file !== null && typeof data.file === "object" && !Array.isArray(data.file)
      ? (data.file as Record<string, unknown>)
      : null;
  const attachmentObj =
    data.attachment !== null &&
    typeof data.attachment === "object" &&
    !Array.isArray(data.attachment)
      ? (data.attachment as Record<string, unknown>)
      : null;
  const nestedFile = fileObj ?? attachmentObj;

  return (
    pickStrFromUpload(
      data.path,
      data.image,
      data.logo,
      root.path,
      root.image,
      nestedFile?.path,
      nestedFile?.image,
      nestedFile?.url,
    ) ?? null
  );
}

/**
 * Updates the signed-in patient's profile photo: tries multipart `PATCH /patient/profile`
 * (field from `VITE_PROFILE_IMAGE_FIELD`, default `image`), then `POST /upload` with
 * `VITE_PROFILE_UPLOAD_TYPE` (default `profile`) and optional JSON `PATCH` with `{ image }`
 * when the upload response includes a path. Always ends with `GET /patient/profile`.
 */
export async function updatePatientProfileImage(file: File): Promise<ProfileDisplay> {
  const field =
    typeof import.meta.env.VITE_PROFILE_IMAGE_FIELD === "string" &&
    import.meta.env.VITE_PROFILE_IMAGE_FIELD.trim()
      ? import.meta.env.VITE_PROFILE_IMAGE_FIELD.trim()
      : "image";

  try {
    const fd = new FormData();
    fd.append(field, file, file.name);
    const res = await patientFetchChecked("profile", { method: "PATCH", body: fd });
    const text = await res.text();
    if (text.trim()) {
      try {
        const raw = JSON.parse(text) as unknown;
        saveCachedProfileRaw(raw);
        return normalizeProfileResponse(raw);
      } catch {
        /* empty or non-JSON — refresh below */
      }
    }
  } catch {
    const rawUpload = await uploadProfileImageFileRaw(file);
    const path = extractProfileImagePathFromUploadResponse(rawUpload);
    if (path && !/^https?:\/\//i.test(path)) {
      try {
        await patientJson<unknown>("profile", {
          method: "PATCH",
          body: JSON.stringify({ image: path }),
        });
      } catch {
        /* server may attach image from upload session alone */
      }
    }
  }

  const raw = await patientJson<unknown>("profile", { method: "GET" });
  saveCachedProfileRaw(raw);
  return normalizeProfileResponse(raw);
}

/** Preferred language from cached `GET /patient/profile` (patient_app `AppSecureStorage.getSavedUser().language`). */
export function readCachedProfileLanguage(): string | null {
  const raw = loadCachedProfileRaw();
  if (!raw) return null;
  return normalizeProfileResponse(raw).language;
}

/** GET /patient/profile (Bearer token via interceptor). */
export async function fetchPatientProfile(): Promise<ProfileDisplay> {
  const raw = await patientJson<unknown>("profile", { method: "GET" });
  saveCachedProfileRaw(raw);
  return normalizeProfileResponse(raw);
}

/** Same GET as {@link fetchPatientProfile}; returns JSON for subscription / `plan.modules`. Updates {@link saveCachedProfileRaw}. */
export async function fetchPatientProfileRaw(): Promise<unknown> {
  const raw = await patientJson<unknown>("profile", { method: "GET" });
  saveCachedProfileRaw(raw);
  return raw;
}
