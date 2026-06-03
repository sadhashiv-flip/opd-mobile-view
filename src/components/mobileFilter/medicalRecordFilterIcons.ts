import myAppointmentsSvg from "@/assets/icons/patient-app/hub/medical_records/my_appointments.svg";
import bookDiagnosticSvg from "@/assets/icons/patient-app/hub/services/bookDaignostics.svg";
import chronicManagementSvg from "@/assets/icons/patient-app/hub/services/chronicManagement.svg";
import dentalServicesSvg from "@/assets/icons/patient-app/hub/services/dentalServices.svg";
import mentalWellnessSvg from "@/assets/icons/patient-app/hub/services/mentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/patient-app/hub/services/nutritionServices.svg";
import vaccinationServicesSvg from "@/assets/icons/patient-app/hub/services/vaccinationServices.svg";
import visionServicesSvg from "@/assets/icons/patient-app/hub/services/visionServices.svg";
import medicalRecordsSvg from "@/assets/icons/patient-app/hub/medical_records.svg";
import labReportsSvg from "@/assets/icons/patient-app/hub/medical_records/lab_reports.svg";
import myPrescriptionsSvg from "@/assets/icons/patient-app/hub/medical_records/my_prescription.svg";

/** Icons for medical-record filter chips — mirrors Flutter `_MedicalRecordsFilterSheet._iconForCategory` assets where possible. */
export function medicalRecordSlugIconSrc(slug: string): string {
  switch (slug) {
    case "consultations":
      return myAppointmentsSvg;
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
    case "dental":
      return dentalServicesSvg;
    case "vision":
      return visionServicesSvg;
    case "vaccine":
      return vaccinationServicesSvg;
    default:
      return labReportsSvg;
  }
}
