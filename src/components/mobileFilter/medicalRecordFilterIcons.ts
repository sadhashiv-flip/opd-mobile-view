import bookConsultationSvg from "@/assets/icons/Services/BookConsultation.svg";
import bookDiagnosticSvg from "@/assets/icons/Services/BookDiagnostic.svg";
import chronicManagementSvg from "@/assets/icons/Services/ChronicManagement.svg";
import mentalWellnessSvg from "@/assets/icons/Services/MentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/Services/NutritionServices.svg";
import medicalRecordsSvg from "@/assets/icons/HelpAndSupport/MedicalRecords.svg";
import labReportsSvg from "@/assets/icons/HelpAndSupport/LabReports.svg";
import myPrescriptionsSvg from "@/assets/icons/HelpAndSupport/MyPrescriptions.svg";

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
