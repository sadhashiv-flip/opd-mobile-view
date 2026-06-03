import homeNavSvg from "@/assets/icons/patient-app/hub/bottom_nav/bottomNavBarHomeIcon.svg";
import { NavSvgMaskIcon } from "./NavSvgMaskIcon";

/** Home FAB — `assets/svg/bottomNavBarHomeIcon.svg` */
export function NavIconHome() {
  return <NavSvgMaskIcon src={homeNavSvg} size={22} variant="fab" />;
}
