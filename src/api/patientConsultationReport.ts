import { readPatientApiError } from "@/api/patientClient";
import { patientFetch } from "@/api/patientHttp";

/**
 * `GET /patient/consultation/:appointmentId/report.pdf` — consultation prescription PDF.
 * Full URL matches `{@link getPatientApiBase}/consultation/APP…/report.pdf`.
 */
export async function fetchConsultationReportPdfBlob(appointmentId: string): Promise<Blob> {
  const id = appointmentId.trim();
  if (!id) {
    throw new Error("Missing appointment id");
  }
  const path = `consultation/${encodeURIComponent(id)}/report.pdf`;
  const res = await patientFetch(path, {
    method: "GET",
    skipGlobalLoading: true,
    headers: { Accept: "application/pdf,*/*" },
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("Empty PDF response");
  }
  return blob;
}

/** Blob URL for inline PDF viewer — caller must {@link URL.revokeObjectURL} when finished. */
export async function fetchConsultationReportPdfObjectUrl(appointmentId: string): Promise<string> {
  const blob = await fetchConsultationReportPdfBlob(appointmentId);
  return URL.createObjectURL(blob);
}

export function triggerConsultationReportPdfDownload(appointmentId: string, blob: Blob): void {
  const id = appointmentId.trim() || "prescription";
  const safe = id.replace(/[^\w.-]+/g, "_");
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${safe}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
