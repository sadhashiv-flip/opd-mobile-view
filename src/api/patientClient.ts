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

/**
 * Base URL for `POST /upload` (e.g. cheque). Falls back to {@link getPatientApiBase} if unset.
 * Set `VITE_API_UPLOAD_URL` when the upload service differs from the main patient API.
 */
export function getUploadApiBase(): string {
  const raw = import.meta.env.VITE_API_UPLOAD_URL;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/$/, "");
  }
  return getPatientApiBase();
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
