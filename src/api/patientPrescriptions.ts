import { patientJson } from "@/api/patientHttp";
import { asRecord } from "@/lib/medicalRecordRow";

/** GET `/patient/prescriptions/{id}` — same as Flutter `PharmacyRepository.getPrescriptionById`. */
export async function fetchPrescriptionById(prescriptionId: string): Promise<Record<string, unknown>> {
  const id = prescriptionId.trim();
  if (!id) throw new Error("Missing prescription id");

  const raw = await patientJson<unknown>(`prescriptions/${encodeURIComponent(id)}`, {
    method: "GET",
    skipGlobalLoading: true,
  });

  const root = asRecord(raw);
  const data = root ? asRecord(root.data) : null;
  const row = data ?? root;
  if (!row) throw new Error("Invalid prescription response");
  return row;
}
