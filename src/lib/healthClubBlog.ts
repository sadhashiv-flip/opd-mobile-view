import { resolveProfileImageUrl } from "@/api/patientProfile";

/** Mirrors Flutter `HealthClubBlog` (`health_club_blog_model.dart`). */
export type HealthClubBlog = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imagePath: string;
  readTimeMinutes: number;
  createdAt: Date | null;
  rawJson: Record<string, unknown>;
}>;

function stripHtmlToPlain(html: string): string {
  const htmlRemoved = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return htmlRemoved.replace(/\s+/g, " ").trim();
}

export function plainDescription(blog: HealthClubBlog): string {
  return stripHtmlToPlain(blog.description);
}

export function shortSubtitle(blog: HealthClubBlog): string {
  if (blog.subtitle.trim()) return blog.subtitle;
  const plain = plainDescription(blog);
  if (plain.length <= 110) return plain;
  return `${plain.slice(0, 110).trim()}…`;
}

export function parseHealthClubBlog(json: Record<string, unknown>): HealthClubBlog {
  const titleRaw = ((json.title ?? json.name) as unknown)?.toString().trim() ?? "";
  const subtitle = ((json.sub_title as unknown)?.toString() ?? "").trim();
  const description = ((json.description as unknown)?.toString() ?? "");
  const imagePath = ((json.image as unknown)?.toString() ?? "").trim();
  const readRaw = json.read_time;
  const readNum =
    typeof readRaw === "number" && Number.isFinite(readRaw)
      ? Math.floor(readRaw)
      : Number.parseInt(String(readRaw ?? ""), 10);
  const readTimeMinutes = Number.isFinite(readNum) ? Math.max(0, readNum) : 0;
  const createdRaw = ((json.createdAt ?? json.created_at) as unknown)?.toString() ?? "";
  const createdAt = createdRaw ? new Date(createdRaw) : null;
  const validDate =
    createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null;

  const title = titleRaw || "Health article";

  return {
    id: ((json.id as unknown)?.toString() ?? "").trim(),
    title,
    subtitle,
    description,
    imagePath,
    readTimeMinutes,
    createdAt: validDate,
    rawJson: { ...json },
  };
}

/** Same rules as Flutter `ApiUrl.publicFileUrl` via {@link resolveProfileImageUrl}. */
export function blogCoverImageUrl(imagePath: string): string | null {
  return resolveProfileImageUrl(imagePath || null);
}

/** Matches Flutter `HealthClubDetailScreen._normalizedHtml`. */
export function normalizeBlogHtml(raw: string): string {
  let html = raw.trim();
  if (html.startsWith('"') && html.endsWith('"') && html.length > 1) {
    html = html.slice(1, -1);
  }
  return html.replace(/\\"/g, '"').replace(/\\n/g, "<br/>").replace(/\\r/g, "");
}
