import bookConsultationSvg from "@/assets/icons/patient-app/hub/services/bookConsultations.svg";
import bookDiagnosticSvg from "@/assets/icons/patient-app/hub/services/bookDaignostics.svg";
import chronicManagementSvg from "@/assets/icons/patient-app/hub/services/chronicManagement.svg";
import mentalWellnessSvg from "@/assets/icons/patient-app/hub/services/mentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/patient-app/hub/services/nutritionServices.svg";
import medicalRecordsSvg from "@/assets/icons/patient-app/hub/medical_records.svg";
import labReportsSvg from "@/assets/icons/patient-app/hub/medical_records/lab_reports.svg";
import myPrescriptionsSvg from "@/assets/icons/patient-app/hub/medical_records/my_prescription.svg";

/** Icons for medical-record filter chips — mirrors Flutter `_MedicalRecordsFilterSheet._iconForCategory` assets where possible. */
export function medicalRecordSlugIconSrc(slug: string): string {
  switch (slug) {
    case "consultations":
      return bookConsultationSvg;
    case "lab-tests":
      return bookDiagnosticSvg;
    case "prescriptions":
      return myPrescriptionsSvg;
    case "vitals":
    case "symptoms":
    case "medicines":
    case "moods":
    case "measurements":
    case "womens":
      return medicalRecordsSvg;
    case "conditions":
      return chronicManagementSvg;
    case "mental-wellness":
      return mentalWellnessSvg;
    case "nutrition":
      return nutritionServicesSvg;
    default:
      return labReportsSvg;
  }
}
