import type { HealthClubBlog } from "@/lib/healthClubBlog";

/** Fallback when API omits `id` — mirrors slug branch of {@link blogRouteParam}. */
export function slugFromTitle(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 48)
    .replace(/\s+/g, "-");
  return s || "article";
}

/** Single `:blogId` path param — React Router encodes when building the path. */
export function blogRouteParam(blog: HealthClubBlog): string {
  const id = blog.id.trim();
  return id || slugFromTitle(blog.title);
}

export function blogMatchesPathParam(blog: HealthClubBlog, pathParam: string | undefined): boolean {
  if (!pathParam) return false;
  let decoded = pathParam;
  try {
    decoded = decodeURIComponent(pathParam);
  } catch {
    /* keep pathParam */
  }
  if (blog.id.trim() && blog.id.trim() === decoded) return true;
  if (!blog.id.trim() && slugFromTitle(blog.title) === decoded) return true;
  return false;
}
