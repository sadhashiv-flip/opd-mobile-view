/**
 * Canonical SPA path for post-consultation chat (matches {@link ROUTES.medicalRecordsConsultationChat}).
 * Example: `/medical-records/consultations/chat/APP1002910D1000059T1776060858`
 */
export function pathToMedicalRecordsConsultationChat(appointmentId: string): string {
  const id = appointmentId.trim();
  if (!id) return "/medical-records/consultations";
  return `/medical-records/consultations/chat/${encodeURIComponent(id)}`;
}
