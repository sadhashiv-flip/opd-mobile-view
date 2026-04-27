import type { HealthClubBlog } from "@/lib/healthClubBlog";

/** Dashboard tiles — matches Flutter `_BlogTile._meta`. */
export function metaDashboardTile(blog: HealthClubBlog): string {
  const parts: string[] = [];
  if (blog.readTimeMinutes > 0) {
    parts.push(`${blog.readTimeMinutes} mins read`);
  }
  if (blog.createdAt) {
    const now = new Date();
    const d = blog.createdAt;
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    parts.push(
      isToday ? "Today" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
    );
  }
  return parts.join("  •  ");
}

/** List rows — matches Flutter `_HealthClubRow._meta`. */
export function metaListRow(blog: HealthClubBlog): string {
  const parts: string[] = [];
  if (blog.createdAt) {
    parts.push(
      blog.createdAt.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    );
  }
  if (blog.readTimeMinutes > 0) {
    parts.push(`${blog.readTimeMinutes} min read`);
  }
  return parts.join("  •  ");
}
