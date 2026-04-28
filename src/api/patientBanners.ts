import type { DashboardBannerSlide } from "@/api/patientDashboard";
import { patientJson } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

/** GET /patient/banners (Bearer). May include dedicated AHC arrays — see {@link normalizePatientBannersPayload}. */

export type PatientBannersApiResponse = Readonly<{
  banners?: unknown;
  /** Optional: banners shown only on the Annual Health Checkup card (see backend contract). */
  ahc_banners?: unknown;
  health_checkup_banners?: unknown;
}>;

export type SplitPatientBanners = Readonly<{
  /** Home promotion carousel — excludes items tagged / listed as AHC-only. */
  promoBanners: DashboardBannerSlide[];
  /** Annual Health Checkup card strip — from `ahc_banners` / `health_checkup_banners` or AHC-tagged rows. */
  ahcBanners: DashboardBannerSlide[];
}>;

/**
 * Absolute URL for banner `image`: unchanged if already `http(s)`; otherwise uses
 * {@link resolveProfileImageUrl} (`VITE_IMAGE_URL` + path, same as profile avatars).
 */
export function resolvePatientBannerImageUrl(raw: string): string {
  return resolveProfileImageUrl(raw.trim()) ?? "";
}

function normKey(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "_")
    .replaceAll("-", "_");
}

/**
 * Rows tagged for Annual Health Checkup vs general home promos.
 * Matches `type` / `category` / `banner_type` / `section` / `placement` / `page` / `tag` when they
 * indicate AHC (e.g. `ahc`, `health_checkup`, `annual_health_checkup`).
 */
export function isAhcBannerRow(row: Record<string, unknown>): boolean {
  const fields = [
    row.type,
    row.banner_type,
    row.category,
    row.section,
    row.placement,
    row.page,
    row.tag,
    row.key,
  ];
  for (const f of fields) {
    const c = normKey(f);
    if (!c) continue;
    if (
      c === "ahc" ||
      c === "annual_health_checkup" ||
      c === "health_checkup" ||
      c === "healthcheckup" ||
      c === "sponsored_health_checkup" ||
      c.includes("annual_health") ||
      (c.includes("health") && (c.includes("checkup") || c.includes("check_up")))
    ) {
      return true;
    }
  }
  return false;
}

function bannerRowToSlide(row: Record<string, unknown>): DashboardBannerSlide | null {
  if (row.status !== true) return null;
  const imageRaw = typeof row.image === "string" ? row.image.trim() : "";
  if (!imageRaw) return null;
  const image = resolvePatientBannerImageUrl(imageRaw);
  if (!image) return null;
  const id =
    row.id != null && (typeof row.id === "number" || typeof row.id === "string")
      ? String(row.id)
      : undefined;
  const link = typeof row.link === "string" ? row.link.trim() : "";
  return { id, image, link };
}

/**
 * Splits active banners into home promo carousel vs AHC card.
 * - Rows in `ahc_banners` / `health_checkup_banners` → AHC only.
 * - Rows in `banners` with {@link isAhcBannerRow} → AHC only.
 * - Other rows in `banners` → promo carousel only.
 */
export function normalizePatientBannersPayload(
  body: PatientBannersApiResponse | null | undefined,
): SplitPatientBanners {
  const promoBanners: DashboardBannerSlide[] = [];
  const ahcBanners: DashboardBannerSlide[] = [];

  const pushRow = (item: unknown, forceAhc: boolean) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const slide = bannerRowToSlide(row);
    if (!slide) return;
    const toAhc = forceAhc || isAhcBannerRow(row);
    if (toAhc) ahcBanners.push(slide);
    else promoBanners.push(slide);
  };

  if (!body || typeof body !== "object") {
    return { promoBanners, ahcBanners };
  }

  const extraKeys = ["ahc_banners", "health_checkup_banners"] as const;
  for (const key of extraKeys) {
    const arr = (body as Record<string, unknown>)[key];
    if (Array.isArray(arr)) {
      for (const item of arr) pushRow(item, true);
    }
  }

  const main = body.banners;
  if (Array.isArray(main)) {
    for (const item of main) pushRow(item, false);
  }

  return { promoBanners, ahcBanners };
}

/** Active (`status === true`) promo banners only — same input shape as legacy `{ banners }` response. */
export function normalizePatientBannersList(raw: unknown): DashboardBannerSlide[] {
  return normalizePatientBannersPayload({ banners: raw }).promoBanners;
}

export async function fetchPatientBanners(): Promise<PatientBannersApiResponse> {
  return patientJson<PatientBannersApiResponse>("banners", {
    method: "GET",
    skipGlobalLoading: true,
  });
}
