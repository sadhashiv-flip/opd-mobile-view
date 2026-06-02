import { resolveProfileImageUrl } from "@/api/patientProfile";
import type { ReimbursementUploadFileRecord } from "@/api/patientReimbursement";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** patient_app upload: `data.path`, `data.logo`, or `data.message.path`. */
export function pickReimbursementUploadPathFromData(data: Record<string, unknown>): string {
  const direct = str(data.path) || str(data.url) || str(data.image);
  if (direct) return direct;
  const logo = str(data.logo);
  if (logo) return logo;
  const msg = asRecord(data.message);
  if (msg) {
    const nested = str(msg.path) || str(msg.logo) || str(msg.url);
    if (nested) return nested;
  }
  return "";
}

export function pickReimbursementUploadNameFromData(
  data: Record<string, unknown>,
  storagePath: string,
): string {
  const title = str(data.title) || str(data.name) || str(data.file_name) || str(data.fileName);
  if (title) return title;
  const logo = str(data.logo);
  if (logo.includes("/")) {
    const base = logo.split("/").pop()?.trim();
    if (base) return base;
  }
  if (storagePath.includes("/")) {
    const base = storagePath.split("/").pop()?.trim();
    if (base) return base;
  }
  return "";
}

export function inferReimbursementFileType(
  storagePath: string,
  displayName: string,
  declared: string,
): string {
  const d = declared.trim().toUpperCase();
  if (d === "PDF") return "PDF";
  const probe = `${displayName} ${storagePath}`.toLowerCase();
  if (probe.includes(".pdf")) return "PDF";
  return d || "IMG";
}

export function reimbursementFileIsPdf(
  file: Pick<ReimbursementUploadFileRecord, "file_type" | "path"> & { name?: string },
): boolean {
  if (file.file_type.toUpperCase().includes("PDF")) return true;
  const probe = `${file.name ?? ""} ${file.path}`.toLowerCase();
  return probe.includes(".pdf");
}

/** Resolved URL for thumbnail / preview (images only). */
export function resolveReimbursementFilePreviewUrl(
  file: Pick<ReimbursementUploadFileRecord, "path">,
): string | null {
  const path = file.path?.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return resolveProfileImageUrl(path);
}

export function reimbursementFileDisplayName(
  file: Pick<ReimbursementUploadFileRecord, "id" | "path"> & { name?: string },
): string {
  const name = file.name?.trim();
  if (name) return name;
  const path = file.path?.trim();
  if (path) {
    const base = path.split("/").pop()?.trim();
    if (base) return base;
  }
  return file.id ? `Document ${file.id.slice(-8)}` : "Document";
}
