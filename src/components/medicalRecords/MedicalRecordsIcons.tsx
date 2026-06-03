import type { IconType } from "react-icons";
import {
  MdAccessTime,
  MdAir,
  MdBiotech,
  MdBloodtype,
  MdCalendarToday,
  MdChevronRight,
  MdFavorite,
  MdHome,
  MdLocalHospital,
  MdLocationOn,
  MdMedicalServices,
  MdMedication,
  MdMedicationLiquid,
  MdMonitorHeart,
  MdOutlineFemale,
  MdOutlineHealing,
  MdOutlineHealthAndSafety,
  MdOutlineMedicalInformation,
  MdOutlineMedicalServices,
  MdOutlineMedication,
  MdOutlineMonitorHeart,
  MdOutlinePsychology,
  MdOutlineRemoveRedEye,
  MdOutlineRestaurant,
  MdOutlineScience,
  MdOutlineSentimentSatisfiedAlt,
  MdOutlineStraighten,
  MdOutlineVaccines,
  MdOutlineVideoCall,
  MdPsychology,
  MdRemoveRedEye,
  MdRestaurant,
  MdScience,
  MdSick,
  MdSpeed,
  MdStraighten,
  MdThermostat,
  MdVaccines,
  MdVideocam,
  MdWaves,
} from "react-icons/md";

const CARD_WHITE = "#fff";

type MrIconProps = Readonly<{
  size?: number;
  color?: string;
  className?: string;
}>;

function renderIcon(
  Icon: IconType,
  { size = 22, color = CARD_WHITE, className }: MrIconProps,
) {
  return <Icon size={size} color={color} className={className} aria-hidden />;
}

/** Flutter `MedicalRecordsCategories.iconFor` (outlined). */
const SLUG_FILTER_ICON: Record<string, IconType> = {
  consultations: MdOutlineVideoCall,
  "lab-tests": MdOutlineScience,
  prescriptions: MdOutlineMedication,
  "mental-wellness": MdOutlinePsychology,
  nutrition: MdOutlineRestaurant,
  dental: MdOutlineMedicalServices,
  vision: MdOutlineRemoveRedEye,
  vaccine: MdOutlineVaccines,
  vitals: MdOutlineMonitorHeart,
  symptoms: MdOutlineHealing,
  medicines: MdOutlineMedicalInformation,
  moods: MdOutlineSentimentSatisfiedAlt,
  measurements: MdOutlineStraighten,
  womens: MdOutlineFemale,
  conditions: MdOutlineHealthAndSafety,
};

export function MedicalRecordSlugIcon({
  slug,
  size = 18,
  color = "currentColor",
  className,
}: Readonly<{ slug: string } & MrIconProps>) {
  const Icon = SLUG_FILTER_ICON[slug] ?? MdOutlineScience;
  return <Icon size={size} color={color} className={className} aria-hidden />;
}

/** Flutter `vital_record_card.dart` `_VitalIcon`. */
const VITAL_TYPE_ICON: Record<string, IconType> = {
  HR: MdFavorite,
  O2: MdAir,
  TEMP: MdThermostat,
  BP: MdSpeed,
  RR: MdWaves,
  SUGAR: MdBloodtype,
};

export function VitalTypeIcon({ type, size = 22 }: Readonly<{ type: string; size?: number }>) {
  const Icon = VITAL_TYPE_ICON[type.toUpperCase()] ?? MdMonitorHeart;
  return renderIcon(Icon, { size });
}

export type ServiceRequestIconKind = "psychology" | "restaurant" | "dental" | "vision" | "vaccine";

const SERVICE_REQUEST_ICON: Record<ServiceRequestIconKind, IconType> = {
  psychology: MdPsychology,
  restaurant: MdRestaurant,
  dental: MdMedicalServices,
  vision: MdRemoveRedEye,
  vaccine: MdVaccines,
};

/** Flutter `medical_records_screen.dart` service list icons. */
export function ServiceRequestCardIcon({
  kind,
  size = 22,
}: Readonly<{ kind: ServiceRequestIconKind; size?: number }>) {
  return renderIcon(SERVICE_REQUEST_ICON[kind], { size });
}

/** Flutter `lab_test_record_card.dart` leading icon. */
export function LabTestCardIcon({
  category,
  size = 22,
}: Readonly<{ category: string; size?: number }>) {
  const radiology = category.toLowerCase() === "radiology";
  return renderIcon(radiology ? MdMonitorHeart : MdBiotech, { size });
}

/** Flutter `prescription_record_card.dart` / `medicine_record_card.dart`. */
export function PrescriptionCardIcon({ size = 22 }: Readonly<{ size?: number }>) {
  return renderIcon(MdMedication, { size });
}

export function HealthLogMedicineIcon({ size = 22 }: Readonly<{ size?: number }>) {
  return renderIcon(MdMedication, { size });
}

/** Flutter `symptom_record_card.dart` `Icons.sick_rounded`. */
export function HealthLogSymptomIcon({ size = 22 }: Readonly<{ size?: number }>) {
  return renderIcon(MdSick, { size });
}

/** Flutter `measurement_record_card.dart` `Icons.straighten_rounded`. */
export function HealthLogMeasurementIcon({ size = 22 }: Readonly<{ size?: number }>) {
  return renderIcon(MdStraighten, { size });
}

/** Flutter `condition_record_card.dart` `Icons.medical_services_rounded`. */
export function HealthLogConditionIcon({ size = 22 }: Readonly<{ size?: number }>) {
  return renderIcon(MdMedicalServices, { size });
}

export function MrIconAccessTime({ size = 13, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdAccessTime, { size, color, className });
}

export function MrIconCalendarToday({ size = 13, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdCalendarToday, { size, color, className });
}

export function MrIconChevronRight({ size = 20, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdChevronRight, { size, color, className });
}

export function MrIconVideocam({ size = 11, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdVideocam, { size, color, className });
}

/** Consultation in-person: `Icons.local_hospital_rounded`. */
export function MrIconLocalHospital({ size = 11, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdLocalHospital, { size, color, className });
}

/** Lab self-visit / service in-person: `Icons.location_on_rounded`. */
export function MrIconLocationOn({ size = 11, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdLocationOn, { size, color, className });
}

export function MrIconHome({ size = 11, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdHome, { size, color, className });
}

/** Flutter `prescription_record_card.dart` medicine count badge. */
export function MrIconMedicationLiquid({ size = 11, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdMedicationLiquid, { size, color, className });
}

/** Flutter `medicine_record_card.dart` dose row. */
export function MrIconScience({ size = 12, color = "currentColor", className }: MrIconProps) {
  return renderIcon(MdScience, { size, color, className });
}
