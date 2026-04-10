import type { DashboardBannerSlide } from "@/api/patientDashboard";
import { patientJson } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

/** GET /patient/banners (Bearer). Response shape: `{ banners: [...] }` (see `api_response.json`). */

export type PatientBannersApiResponse = Readonly<{
  banners?: unknown;
}>;

/**
 * Absolute URL for banner `image`: unchanged if already `http(s)`; otherwise uses
 * {@link resolveProfileImageUrl} (`VITE_IMAGE_URL` + path, same as profile avatars).
 */
export function resolvePatientBannerImageUrl(raw: string): string {
  return resolveProfileImageUrl(raw.trim()) ?? "";
}

/** Active (`status === true`) banners with resolved image URLs. */
export function normalizePatientBannersList(raw: unknown): DashboardBannerSlide[] {
  if (!Array.isArray(raw)) return [];
  const out: DashboardBannerSlide[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.status !== true) continue;
    const imageRaw = typeof row.image === "string" ? row.image.trim() : "";
    if (!imageRaw) continue;
    const image = resolvePatientBannerImageUrl(imageRaw);
    if (!image) continue;
    const id = row.id != null && (typeof row.id === "number" || typeof row.id === "string")
      ? String(row.id)
      : undefined;
    out.push({
      id,
      image,
      link: "",
    });
  }
  return out;
}

export async function fetchPatientBanners(): Promise<PatientBannersApiResponse> {
  return patientJson<PatientBannersApiResponse>("banners", {
    method: "GET",
    skipGlobalLoading: true,
  });
}
