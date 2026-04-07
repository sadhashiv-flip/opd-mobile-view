import bookConsultationSvg from "@/assets/icons/Services/BookConsultation.svg";
import bookDiagnosticSvg from "@/assets/icons/Services/BookDiagnostic.svg";
import dentalServicesSvg from "@/assets/icons/Services/DentalServices.svg";
import gymAndFitnessSvg from "@/assets/icons/Services/GymAndFitness.svg";
import mentalWellnessSvg from "@/assets/icons/Services/MentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/Services/NutritionServices.svg";
import prescribedPharmacySvg from "@/assets/icons/Services/PrescribedPharmacy.svg";
import vaccinationServicesSvg from "@/assets/icons/Services/VaccinationServices.svg";
import visionServicesSvg from "@/assets/icons/Services/VissionServices.svg";
import viewServicesSvg from "@/assets/icons/Services/ViewServices.svg";

export function orderCategoryIconSrc(categoryKey: string): string {
  switch (categoryKey) {
    case "consultation":
      return bookConsultationSvg;
    case "lab":
      return bookDiagnosticSvg;
    case "pharmacy":
      return prescribedPharmacySvg;
    case "dental":
      return dentalServicesSvg;
    case "vision":
      return visionServicesSvg;
    case "vaccine":
      return vaccinationServicesSvg;
    case "gym":
      return gymAndFitnessSvg;
    case "mental_wellness":
      return mentalWellnessSvg;
    case "nutrition":
      return nutritionServicesSvg;
    default:
      return viewServicesSvg;
  }
}

type OrderCategoryIconProps = Readonly<{
  categoryKey: string;
  className?: string;
  width?: number;
  height?: number;
}>;

export function OrderCategoryIcon({
  categoryKey,
  className = "",
  width = 28,
  height = 28,
}: OrderCategoryIconProps) {
  return (
    <img
      src={orderCategoryIconSrc(categoryKey)}
      alt=""
      className={className}
      width={width}
      height={height}
      draggable={false}
    />
  );
}
