/**
 * Shared base URL + error parsing for `/patient/*` endpoints.
 *
 * Dev CORS: set `VITE_API_BASE_URL` to `http://localhost:3000/dev-api` (same port as Vite) and
 * `VITE_DEV_API_PROXY_TARGET` in `.env` so `vite.config.js` forwards `/dev-api/*` to the real API.
 */

export function getPatientApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  const base = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not set in .env");
  }
  return base;
}

const PATIENT_SUFFIX = "/patient";

/**
 * Uploads use `POST {base}/upload`. The patient REST API often lives at `{host}/patient`, while
 * upload is at `{host}/upload` — not `{host}/patient/upload`. Strip a trailing `/patient` from the
 * chosen base so `patientFetchUpload("upload", …)` resolves to the root upload route.
 */
function normalizeUploadApiBase(raw: string): string {
  let base = raw.trim().replace(/\/$/, "");
  if (base.endsWith(PATIENT_SUFFIX)) {
    base = base.slice(0, -PATIENT_SUFFIX.length);
  }
  return base.replace(/\/$/, "");
}

/**
 * Base URL for `POST /upload` (e.g. prescription, cheque). Result never ends with `/patient`.
 * Set `VITE_API_UPLOAD_URL` to the server root (e.g. `http://localhost:2017`) when uploads must not
 * go to `{VITE_API_BASE_URL}/upload` under a `/patient` prefix.
 * If unset, derives from {@link getPatientApiBase} with `/patient` stripped when present.
 */
export function getUploadApiBase(): string {
  const raw = import.meta.env.VITE_API_UPLOAD_URL;
  if (typeof raw === "string" && raw.trim()) {
    return normalizeUploadApiBase(raw);
  }
  return normalizeUploadApiBase(getPatientApiBase());
}

/**
 * Host root for routes outside `/patient` (e.g. `GET /notice-board`). Strips a trailing `/patient` from
 * {@link getPatientApiBase} — same normalization as the upload base when `VITE_API_UPLOAD_URL` is unset.
 */
export function getPatientApiRootBase(): string {
  return normalizeUploadApiBase(getPatientApiBase());
}

export async function readPatientApiError(res: Response): Promise<string> {
  const text = await res.text();
  const prefix = `HTTP ${res.status}`;
  if (!text) return `${prefix} — empty response body`;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const msg = data.message ?? data.error ?? data.detail;
    if (typeof msg === "string" && msg.trim()) return `${prefix}: ${msg.trim()}`;
    if (Array.isArray(msg) && typeof msg[0] === "string") return `${prefix}: ${msg[0]}`;
  } catch {
    // not JSON
  }
  const snippet = text.replace(/\s+/g, " ").slice(0, 200);
  return snippet ? `${prefix}: ${snippet}` : `${prefix}`;
}
