/** Selected exercise tag for {@link ROUTES.fitnessTag} (survives refresh when possible). */
export const FITNESS_SELECTED_TAG_KEY = "opd-mobile-view.fitness.selectedTag.v1";

export type FitnessTagSnapshot = Readonly<{
  id: string;
  name: string;
  image?: string | null;
}>;

export function writeFitnessTagSnapshot(tag: FitnessTagSnapshot): void {
  try {
    sessionStorage.setItem(FITNESS_SELECTED_TAG_KEY, JSON.stringify(tag));
  } catch {
    /* ignore quota */
  }
}

export function readFitnessTagSnapshot(): FitnessTagSnapshot | null {
  try {
    const raw = sessionStorage.getItem(FITNESS_SELECTED_TAG_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const id = rec.id != null ? String(rec.id).trim() : "";
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!id || !name) return null;
    const image = rec.image != null ? String(rec.image) : null;
    return { id, name, image: image?.length ? image : null };
  } catch {
    return null;
  }
}
