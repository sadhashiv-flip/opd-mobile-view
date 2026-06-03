import ordersNavSvg from "@/assets/icons/patient-app/hub/bottom_nav/my_orders_bottom_navbar.svg";
import { NavSvgMaskIcon } from "./NavSvgMaskIcon";

/** My Orders — `assets/svg/my_orders_bottom_navbar.svg` */
export function NavIconOrders() {
  return <NavSvgMaskIcon src={ordersNavSvg} size={22} />;
}
