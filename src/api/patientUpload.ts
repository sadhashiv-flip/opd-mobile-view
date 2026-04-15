import { patientFetchChecked, patientFetchUploadChecked } from "@/api/patientHttp";
import type { ChecklistUploadKind, ReimbursementUploadFileRecord } from "@/api/patientReimbursement";
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

function pickNonEmptyString(...candidates: readonly unknown[]): string {
  for (const v of candidates) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
  }
  return "";
}

/** Fields commonly returned by `POST /upload` with `type=prescription` (plus full `raw` for forward-compat). */
export type PrescriptionUploadResult = Readonly<{
  /** Use as `POST /medicine` → `prescriptions[].prescription_id` for `type: "OTHER"`. */
  prescriptionId: string;
  /** Useful keys normalized from the response (when present). */
  meta: Readonly<{
    id?: string;
    prescription_id?: string;
    attachment_id?: string;
    file_name?: string;
    /** Relative storage path — combine with `VITE_IMAGE_URL` for preview. */
    path?: string;
    url?: string;
    type?: string;
  }>;
  /** Parsed JSON body from `/upload`. */
  raw: unknown;
}>;

/**
 * Maps `/upload` JSON to {@link PrescriptionUploadResult}. Accepts several backend shapes:
 * `{ data: { id } }`, `{ data: { prescription_id } }`, `{ id }`, nested `file` / `attachment`.
 */
export function parsePrescriptionUploadResponse(parsed: unknown): PrescriptionUploadResult {
  const root = asRecord(parsed);
  if (!root) throw new Error("Invalid upload response");

  const data = asRecord(root.data);
  const inner = data ?? root;
  const fileObj = asRecord(inner.file) ?? asRecord(inner.attachment) ?? asRecord(inner.document);

  const prescriptionId = pickNonEmptyString(
    inner.prescription_id,
    data?.prescription_id,
    fileObj?.prescription_id,
    inner.id,
    data?.id,
    fileObj?.id,
    root.prescription_id,
    root.id,
    inner.attachment_id,
    fileObj?.attachment_id,
  );

  if (!prescriptionId) {
    throw new Error("Upload response missing prescription id");
  }

  const id = pickNonEmptyString(inner.id, data?.id, fileObj?.id, root.id);
  const path =
    pickNonEmptyString(inner.path, data?.path, inner.logo, data?.logo, fileObj?.path) || undefined;
  const meta = {
    id: id || undefined,
    prescription_id:
      pickNonEmptyString(inner.prescription_id, data?.prescription_id, fileObj?.prescription_id) || undefined,
    attachment_id:
      pickNonEmptyString(inner.attachment_id, fileObj?.attachment_id, data?.attachment_id) || undefined,
    file_name:
      (typeof inner.file_name === "string" && inner.file_name.trim()) ||
      (typeof inner.name === "string" && inner.name.trim()) ||
      (typeof inner.title === "string" && inner.title.trim()) ||
      undefined,
    path,
    url: typeof inner.url === "string" && inner.url.trim() ? inner.url.trim() : undefined,
    type: typeof inner.type === "string" && inner.type.trim() ? inner.type.trim() : undefined,
  };

  return { prescriptionId, meta, raw: parsed };
}

/**
 * POST `{VITE_API_UPLOAD_URL || VITE_API_BASE_URL}/upload` — multipart: `type=prescription`, `file`, `token`.
 * Parses the response for `POST /medicine` (`prescription_id`) and any extra fields in {@link PrescriptionUploadResult.meta}.
 */
export async function uploadPrescriptionFile(file: File): Promise<PrescriptionUploadResult> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("type", "prescription");
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

  return parsePrescriptionUploadResponse(parsed);
}

export type ConsultationUploadRefType = "ATTACHMENT" | "REPORT";

/**
 * POST `attachment` on the patient API — multipart: `type=CONSULTATION`, `file`, `ref_id` (appointment id),
 * `ref_type` (`ATTACHMENT` | `REPORT`). Auth via Bearer (not the `/upload` host).
 */
export async function uploadConsultationRefDocumentFile(
  file: File,
  refId: string,
  refType: ConsultationUploadRefType,
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");
  const rid = refId.trim();
  if (!rid) throw new Error("Missing appointment id");

  const fd = new FormData();
  fd.append("type", "CONSULTATION");
  fd.append("file", file, file.name);
  fd.append("ref_id", rid);
  fd.append("ref_type", refType);

  const res = await patientFetchChecked("attachment", {
    method: "POST",
    body: fd,
    skipGlobalLoading: true,
  });
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty attachment response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid attachment response");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Attachment response must be a JSON object or array");
  }
  return parsed;
}

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

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Parses reimbursement `/upload` JSON into the shape expected on `POST /patient/reimbursement` file rows. */
export function parseReimbursementUploadResponse(
  parsed: unknown,
  fallback: Readonly<{ document_type: string; ref_type: string }>,
): ReimbursementUploadFileRecord {
  const root = asRecord(parsed) ?? {};
  const data = asRecord(root.data) ?? root;
  const idRaw = data.id ?? root.id;
  const id =
    typeof idRaw === "string"
      ? idRaw.trim()
      : typeof idRaw === "number" && Number.isFinite(idRaw)
        ? String(idRaw)
        : "";
  if (!id) throw new Error("Upload response missing data.id");

  const path = str(data.path);
  const file_type =
    str(data.file_type) ||
    str((data as Record<string, unknown>).fileType) ||
    str(data.type) ||
    "IMG";
  const document_type = str(data.document_type) || str((data as Record<string, unknown>).documentType) || fallback.document_type;
  const ref_type =
    str(data.ref_type) || str((data as Record<string, unknown>).refType) || str(data.ref) || fallback.ref_type;

  return { id, path, file_type, document_type, ref_type };
}

/**
 * POST `{upload base}/upload` — multipart reimbursement bill:
 * `type=reimbursement`, `file`, `ref_type=BILL`, `document_type` / `document_name` (bill number), `token`.
 * Returns file row fields for `reimbursement_bill_files[]` on `POST /patient/reimbursement`.
 */
export async function uploadReimbursementBillDocumentId(file: File, billNumber: string): Promise<ReimbursementUploadFileRecord> {
  const docKey = billNumber.trim();
  if (!docKey) throw new Error("Bill number is required before upload");

  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("type", "reimbursement");
  fd.append("file", file, file.name);
  fd.append("ref_type", "BILL");
  fd.append("document_type", docKey);
  fd.append("document_name", docKey);
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

  return parseReimbursementUploadResponse(parsed, { document_type: docKey, ref_type: "BILL" });
}

/**
 * Reimbursement checklist `/upload` — `ref_type` / `document_type` / `document_name` depend on slot kind
 * (payment / prescription / report / support vs legacy BILL slot).
 */
export async function uploadReimbursementChecklistDocumentId(
  file: File,
  billNumber: string,
  uploadKind: ChecklistUploadKind,
  particularsKey: string,
): Promise<ReimbursementUploadFileRecord> {
  const bill = billNumber.trim();
  const key = particularsKey.trim();
  if (!bill) throw new Error("Bill number is required before upload");
  if (!key && uploadKind === "legacy") throw new Error("Document slot is required before upload");

  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("type", "reimbursement");
  fd.append("file", file, file.name);

  switch (uploadKind) {
    case "payment":
      fd.append("ref_type", "PAYMENT");
      fd.append("document_type", "payments");
      fd.append("document_name", "PAYMENTS");
      break;
    case "prescription":
      fd.append("ref_type", "REPORT");
      fd.append("document_type", "prescription");
      fd.append("document_name", "PRESCRIPTION");
      break;
    case "report":
      fd.append("ref_type", "REPORT");
      fd.append("document_type", "report");
      fd.append("document_name", "REPORT");
      break;
    case "support":
      fd.append("ref_type", "OTHER");
      fd.append("document_type", "OTHER");
      fd.append("document_name", "OTHER");
      break;
    default:
      fd.append("ref_type", "BILL");
      fd.append("document_type", key);
      fd.append("document_name", `${bill}|${key}`);
  }

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

  const fb =
    uploadKind === "payment"
      ? { document_type: "payments", ref_type: "PAYMENT" }
      : uploadKind === "prescription"
        ? { document_type: "prescription", ref_type: "REPORT" }
        : uploadKind === "report"
          ? { document_type: "report", ref_type: "REPORT" }
          : uploadKind === "support"
            ? { document_type: "OTHER", ref_type: "OTHER" }
            : { document_type: key || bill, ref_type: "BILL" };

  return parseReimbursementUploadResponse(parsed, fb);
}
