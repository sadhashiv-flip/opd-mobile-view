import clinicIcon from "@/assets/icons/patient-app/overview/overview-clinic.svg";
import medicalIcon from "@/assets/icons/patient-app/overview/overview-medical.svg";
import callIcon from "@/assets/icons/patient-app/overview/overview-call.svg";
import eventIcon from "@/assets/icons/patient-app/overview/overview-event.svg";
import locationPinIcon from "@/assets/icons/patient-app/overview/overview-location-pin.svg";
import personIcon from "@/assets/icons/patient-app/overview/overview-person.svg";
import accessTimeIcon from "@/assets/icons/patient-app/overview/overview-access-time.svg";
import editIcon from "@/assets/icons/patient-app/overview/overview-edit.svg";
import infoIcon from "@/assets/icons/patient-app/overview/overview-info.svg";

type IconProps = Readonly<{ size?: number; className?: string }>;

function OverviewImg({
  src,
  size = 16,
  className,
}: Readonly<{ src: string; size?: number; className?: string }>) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}

/** Section header icons — patient_app `DentalOverviewScreen` Material icons. */
export function DentalOverviewIconClinic({ size = 16, className = "overview-section-card__icon" }: IconProps) {
  return <OverviewImg src={clinicIcon} size={size} className={className} />;
}

export function DentalOverviewIconMedical({ size = 16, className = "overview-section-card__icon" }: IconProps) {
  return <OverviewImg src={medicalIcon} size={size} className={className} />;
}

export function DentalOverviewIconCall({ size = 16, className = "overview-section-card__icon" }: IconProps) {
  return <OverviewImg src={callIcon} size={size} className={className} />;
}

export function DentalOverviewIconEvent({ size = 16, className = "overview-section-card__icon" }: IconProps) {
  return <OverviewImg src={eventIcon} size={size} className={className} />;
}

export function DentalOverviewIconLocationPin({ size = 12, className = "dental-overview-page__pin-img" }: IconProps) {
  return <OverviewImg src={locationPinIcon} size={size} className={className} />;
}

export function DentalOverviewIconPerson({ size = 14, className = "dental-overview-page__person-img" }: IconProps) {
  return <OverviewImg src={personIcon} size={size} className={className} />;
}

export function DentalOverviewIconAccessTime({ size = 16, className = "dental-overview-page__dt-icon-img" }: IconProps) {
  return <OverviewImg src={accessTimeIcon} size={size} className={className} />;
}

export function DentalOverviewIconEdit({ size = 20, className = "dental-overview-page__dt-edit-img" }: IconProps) {
  return <OverviewImg src={editIcon} size={size} className={className} />;
}

export function DentalOverviewIconInfo({ size = 16, className = "dental-overview-page__notes-icon-img" }: IconProps) {
  return <OverviewImg src={infoIcon} size={size} className={className} />;
}
