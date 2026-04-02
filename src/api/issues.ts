import { patientJson } from "@/api/patientHttp";

/** Specialty row from GET `/issues` (backend naming). */
export type PatientIssue = Readonly<{
  id: number;
  title: string;
  image: string | null;
  /** Used for GET `/speciality/:parent_id/doctors`. */
  parent: number;
}>;

function asFiniteId(idRaw: unknown): number | null {
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) return idRaw;
  if (typeof idRaw === "string") {
    const n = Number(idRaw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeIssue(raw: unknown): PatientIssue | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asFiniteId(r.id);
  if (id === null) return null;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const image = typeof r.image === "string" && r.image.trim() ? r.image.trim() : null;
  const parent = asFiniteId(r.parent) ?? id;
  return { id, title: title || "Specialty", image, parent };
}

export type FetchPatientIssuesParams = Readonly<{
  /**
   * Parent id for hierarchical issues. Sample rows used `parent: 1`; the list
   * endpoint often requires this (matches what Postman may send as `?parent=1`).
   */
  parent?: number;
}>;

/** Root parent id used when the API expects a parent filter (align with backend). */
export const DEFAULT_ISSUES_PARENT = 1;

function extractIssuesList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body !== null && typeof body === "object") {
    const root = body as Record<string, unknown>;
    const issues = root.issues;
    if (Array.isArray(issues)) return issues;
  }
  return [];
}

/** GET `/patient/issues?parent=…` — list of consultation specialties (issues). */
export async function fetchPatientIssues(
  params: FetchPatientIssuesParams = {},
): Promise<PatientIssue[]> {
  const parent = params.parent ?? DEFAULT_ISSUES_PARENT;
  const q = new URLSearchParams();
  q.set("parent", String(parent));
  const raw = await patientJson<unknown>(`issues?${q.toString()}`, { method: "GET" });
  return extractIssuesList(raw)
    .map(normalizeIssue)
    .filter((x): x is PatientIssue => x !== null);
}
