import medicalRecordsNavSvg from "@/assets/icons/patient-app/hub/medical_records.svg";
import { NavSvgMaskIcon } from "./NavSvgMaskIcon";

/** Medical Records — `assets/svg/all services icons/medical_records.svg` (33px in Flutter nav). */
export function NavIconMedicalRecords() {
  return <NavSvgMaskIcon src={medicalRecordsNavSvg} size={33} variant="medical" />;
}
