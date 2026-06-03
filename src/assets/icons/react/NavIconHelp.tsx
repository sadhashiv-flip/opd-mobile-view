import helpNavSvg from "@/assets/icons/patient-app/hub/bottom_nav/need_help_bottom_navbar.svg";
import { NavSvgMaskIcon } from "./NavSvgMaskIcon";

/** Need Help? — `assets/svg/need_help_bottom_navbar.svg` */
export function NavIconHelp() {
  return <NavSvgMaskIcon src={helpNavSvg} size={22} />;
}
