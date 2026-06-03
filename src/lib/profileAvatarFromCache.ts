import { normalizeProfileResponse } from "@/api/patientProfile";
import { initialsFromName } from "@/components/profile/page/profilePageUtils";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Cached profile image path (patient-app `ProfileAvatarThumb._storedProfileImagePath`). */
export function profileImagePathFromRaw(body: unknown): string | null {
  if (body == null) return null;
  const image = normalizeProfileResponse(body).image;
  if (image == null) return null;
  const t = image.trim();
  if (!t || t.toLowerCase() === "null") return null;
  return t;
}

/** Initials for network avatar placeholder (patient-app `ProfileAvatarThumb._profileInitials`). */
export function profileInitialsFromRaw(body: unknown): string {
  const root = asRecord(body) ?? {};
  const pickUser =
    asRecord(root.user) ??
    asRecord(root.profile) ??
    asRecord(root.data) ??
    (asRecord(root.patient) ?? root);

  const first = str(pickUser.first_name) ?? "";
  const last = str(pickUser.last_name) ?? "";
  const f = first.length > 0 ? first.charAt(0).toUpperCase() : "";
  const l = last.length > 0 ? last.charAt(0).toUpperCase() : "";
  const fromParts = `${f}${l}`;
  if (fromParts) return fromParts;

  const name = str(pickUser.name) ?? normalizeProfileResponse(body ?? {}).name;
  if (name.trim()) {
    const fromName = initialsFromName(name);
    if (fromName !== "?") return fromName.slice(0, 2);
  }
  return "U";
}
