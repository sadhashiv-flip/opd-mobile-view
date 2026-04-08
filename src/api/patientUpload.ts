import { patientFetchUploadChecked } from "@/api/patientHttp";
import { getAccessToken } from "@/lib/authStorage";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * POST `{VITE_API_UPLOAD_URL || VITE_API_BASE_URL}/upload` — multipart: type, bank, file, token.
 * Returns attachment id from `data.id` for bank_details.cheque.
 */
export async function uploadBankChequeFile(
  file: File,
  /** Bank type `key` from GET type?search=type:bank */
  bankKey: string,
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("type", "bank");
  fd.append("bank", bankKey.trim());
  fd.append("file", file);
  fd.append("token", token);

  const res = await patientFetchUploadChecked("upload", { method: "POST", body: fd });
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty upload response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid upload response");
  }

  const root = asRecord(parsed);
  const data = root ? asRecord(root.data) : null;
  const rawId = data?.id ?? root?.id;
  let id = "";
  if (typeof rawId === "string") id = rawId.trim();
  else if (typeof rawId === "number") id = String(rawId);
  if (!id) throw new Error("Upload response missing data.id");
  return id;
}

/**
 * POST `{VITE_API_UPLOAD_URL || VITE_API_BASE_URL}/upload` — multipart: `type=document`, `file`, `token`.
 * Sends `app_name` (from `VITE_UPLOAD_APP_NAME`, default `co-flip-health`).
 * Returns the full parsed JSON body from `/upload` (forwarded as-is to `POST support/ticket/:id`).
 */
export async function uploadSupportDocumentFile(file: File): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("type", "document");
  fd.append("file", file, file.name);
  fd.append("token", token);

  const appName =
    typeof import.meta.env.VITE_UPLOAD_APP_NAME === "string" && import.meta.env.VITE_UPLOAD_APP_NAME.trim()
      ? import.meta.env.VITE_UPLOAD_APP_NAME.trim()
      : "co-flip-health";

  const res = await patientFetchUploadChecked("upload", {
    method: "POST",
    body: fd,
    headers: { app_name: appName },
  });
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty upload response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid upload response");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Upload response must be a JSON object or array");
  }
  return parsed;
}
