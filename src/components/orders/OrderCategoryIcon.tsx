import subscriptionsSvg from "@/assets/icons/patient-app/hub/account_management/subscriptions.svg";
import bookConsultationSvg from "@/assets/icons/patient-app/hub/services/bookConsultations.svg";
import bookDiagnosticSvg from "@/assets/icons/patient-app/hub/services/bookDaignostics.svg";
import dentalServicesSvg from "@/assets/icons/patient-app/hub/services/dentalServices.svg";
import gymAndFitnessSvg from "@/assets/icons/patient-app/hub/services/gymAndFitness.svg";
import mentalWellnessSvg from "@/assets/icons/patient-app/hub/services/mentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/patient-app/hub/services/nutritionServices.svg";
import prescribedPharmacySvg from "@/assets/icons/patient-app/hub/services/prescribedPharmacy.svg";
import vaccinationServicesSvg from "@/assets/icons/patient-app/hub/services/vaccinationServices.svg";
import visionServicesSvg from "@/assets/icons/patient-app/hub/services/visionServices.svg";
import viewServicesSvg from "@/assets/icons/patient-app/hub/tab_bar_icons/services.svg";

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
    case "fitness":
    case "yoga":
      return gymAndFitnessSvg;
    case "mental_wellness":
      return mentalWellnessSvg;
    case "nutrition":
      return nutritionServicesSvg;
    case "subscriptions":
      return subscriptionsSvg;
    case "orders_all":
      return viewServicesSvg;
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
