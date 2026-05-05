/**
 * Fitness / workout videos — parity with patient-webapp {@code FitnessService}:
 * `GET video/category`, `GET video/category/:id`, favorites.
 */

import { patientJson } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

export type FitnessTag = Readonly<{
  id: number | string;
  name: string;
  image: string;
  isFavorite: number;
}>;

export type FitnessCategory = Readonly<{
  name: string;
  tags: FitnessTag[];
}>;

export type FitnessFavoriteRow = Readonly<{
  item_id?: number | string;
  name?: string;
  item?: FitnessTag;
}>;

export type FitnessVideo = Readonly<{
  id?: number | string;
  name: string;
  /** Relative or absolute media URL */
  video: string;
  cal?: number | string;
  /** Repetitions per exercise (Angular completes when rounds reach this — we combine with {@link sets}). */
  reps?: number;
  /** Sets — total rounds = `reps * sets` when both set (see {@link fitnessTotalRounds} in UI). */
  sets?: number;
  /** Per-rep / per-round duration in **seconds** (Angular `countdown` uses raw `time`). */
  time?: number | string;
  category_id?: number;
  type?: string;
}>;

/** Same subset as Angular {@code fitnesslist.component} (show all if none match). */
export const FITNESS_CATEGORY_NAMES_ALLOWLIST = [
  "Basics",
  "Abs",
  "Upper body",
  "Lower Body",
] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function parseTag(raw: unknown): FitnessTag | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = o.id ?? o.tag_id;
  const name = o.name;
  const imageRaw = o.image;
  const image =
    typeof imageRaw === "string"
      ? imageRaw
      : imageRaw != null
        ? String(imageRaw)
        : "";
  if (id == null || typeof name !== "string") return null;
  const favRaw = o.isFavorite ?? o.is_favorite ?? 0;
  const isFavorite =
    favRaw === true || favRaw === 1 || favRaw === "1" ? 1 : 0;
  return {
    id,
    name,
    image,
    isFavorite,
  };
}

function parseCategory(raw: unknown): FitnessCategory | null {
  const o = asRecord(raw);
  if (!o || typeof o.name !== "string") return null;
  const tagsRaw = o.tags;
  const tags: FitnessTag[] = [];
  if (Array.isArray(tagsRaw)) {
    for (const t of tagsRaw) {
      const p = parseTag(t);
      if (p) tags.push(p);
    }
  }
  return { name: o.name, tags };
}

export async function fetchFitnessCategories(): Promise<readonly FitnessCategory[]> {
  const raw = await patientJson<unknown>("video/category", { method: "GET" });
  const root = asRecord(raw);
  const list = root?.categories ?? root?.data;
  if (!Array.isArray(list)) return [];
  const out: FitnessCategory[] = [];
  for (const c of list) {
    const p = parseCategory(c);
    if (p && p.tags.length > 0) out.push(p);
  }
  return out;
}

export function filterFitnessCategoriesForUi(
  categories: readonly FitnessCategory[],
): readonly FitnessCategory[] {
  const allow = new Set(FITNESS_CATEGORY_NAMES_ALLOWLIST.map((s) => s.toLowerCase()));
  const filtered = categories.filter((c) => allow.has(c.name.trim().toLowerCase()));
  return filtered.length > 0 ? filtered : categories;
}

export async function fetchFitnessVideosForTag(tagId: string): Promise<readonly FitnessVideo[]> {
  const id = tagId.trim();
  if (!id) return [];
  const raw = await patientJson<unknown>(`video/category/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  const root = asRecord(raw);
  const list = root?.videos ?? root?.data;
  if (!Array.isArray(list)) return [];
  const out: FitnessVideo[] = [];
  for (const v of list) {
    const o = asRecord(v);
    if (!o || typeof o.name !== "string") continue;
    const vid =
      pickOptionalString(o.video) ??
      pickOptionalString(o.video_url) ??
      pickOptionalString(o.url) ??
      pickOptionalString(o.file) ??
      pickOptionalString(o.src);
    if (!vid) continue;
    const repsNum = toOptionalPositiveInt(o.reps);
    const setsNum = toOptionalPositiveInt(o.sets);
    out.push({
      id: o.id,
      name: o.name,
      video: vid,
      cal: o.cal,
      reps: repsNum,
      sets: setsNum,
      time: o.time,
      category_id: (() => {
        const n =
          typeof o.category_id === "number" ? o.category_id : Number(o.category_id);
        return Number.isFinite(n) ? n : undefined;
      })(),
      type: pickOptionalString(o.type) ?? undefined,
    });
  }
  return out;
}

function pickOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function toOptionalPositiveInt(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export async function fetchFitnessFavorites(): Promise<readonly FitnessFavoriteRow[]> {
  const raw = await patientJson<unknown>("video/category/favorites", { method: "GET" });
  const root = asRecord(raw);
  const list = root?.favorites ?? root?.data;
  if (!Array.isArray(list)) return [];
  return list as FitnessFavoriteRow[];
}

export async function toggleFitnessFavorite(tagId: string): Promise<string | null> {
  const id = tagId.trim();
  if (!id) throw new Error("Missing tag id");
  const raw = await patientJson<unknown>(`video/category/${encodeURIComponent(id)}/favorite`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
  const root = asRecord(raw);
  const msg = root?.message;
  return typeof msg === "string" ? msg : null;
}

/** Absolute URL for CDN-relative paths from {@link FitnessVideo.video}. */
export function resolveFitnessVideoUrl(path: string): string {
  const u = resolveProfileImageUrl(path);
  return u ?? path;
}
