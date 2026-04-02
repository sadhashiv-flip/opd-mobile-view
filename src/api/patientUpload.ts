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
