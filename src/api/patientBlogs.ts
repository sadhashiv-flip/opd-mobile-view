import { patientJsonListRoot } from "@/api/patientHttp";
import { parseHealthClubBlog, type HealthClubBlog } from "@/lib/healthClubBlog";

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/**
 * `GET /blogs?page=&limit=` on the API host root (no `/patient` prefix).
 */
export async function fetchPatientBlogs(options?: {
  page?: number;
  limit?: number;
}): Promise<readonly HealthClubBlog[]> {
  const raw = await patientJsonListRoot<unknown>("blog", { method: "GET" }, options);
  const body = asRecord(raw) ?? {};

  if (body.status === false) {
    const msg =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : "Failed to load blogs";
    throw new Error(msg);
  }

  const data = body.data;
  const payload = data != null && typeof data === "object" && !Array.isArray(data) ? asRecord(data) : body;

  const rowsUnknown = payload?.blogs ?? body.blogs;
  if (!Array.isArray(rowsUnknown)) return [];

  const out: HealthClubBlog[] = [];
  for (const row of rowsUnknown) {
    const m = asRecord(row);
    if (m) out.push(parseHealthClubBlog(m));
  }
  return out;
}
