import servicesNavSvg from "@/assets/icons/patient-app/hub/bottom_nav/services_bottom_navbar.svg";
import { NavSvgMaskIcon } from "./NavSvgMaskIcon";

/** Services — `assets/svg/services_bottom_navbar.svg` */
export function NavIconServices() {
  return <NavSvgMaskIcon src={servicesNavSvg} size={22} />;
}
