import {
  NavIconHelp,
  NavIconHome,
  NavIconOrders,
  NavIconPharmacyFab,
  NavIconServices,
} from "@/assets/icons";
import { ROUTES } from "@/constants";
import { NavLink } from "react-router-dom";

/** Bottom tab bar — matches mobile spec: outline icons, orange active, raised Pharmacy FAB. */
export function HomeBottomNav() {
  return (
    <nav className="home-nav" aria-label="Primary">
      <NavLink
        to={ROUTES.dashboard}
        end
        className={({ isActive }) =>
          `home-nav__item${isActive ? " home-nav__item--active" : ""}`
        }
      >
        <span className="home-nav__ic" aria-hidden="true">
          <NavIconHome />
        </span>
        <span className="home-nav__label">Home</span>
      </NavLink>
      <NavLink
        to={ROUTES.services}
        className={({ isActive }) =>
          `home-nav__item${isActive ? " home-nav__item--active" : ""}`
        }
      >
        <span className="home-nav__ic" aria-hidden="true">
          <NavIconServices />
        </span>
        <span className="home-nav__label">Services</span>
      </NavLink>
      <div className="home-nav__fab-wrap">
        <NavLink
          to={ROUTES.pharmacy}
          className={({ isActive }) =>
            `home-nav__fab${isActive ? " home-nav__fab--active" : ""}`
          }
          aria-label="Pharmacy"
        >
          <span className="home-nav__fab-icon" aria-hidden="true">
            <NavIconPharmacyFab />
          </span>
        </NavLink>
        <span className="home-nav__fab-label">Pharmacy</span>
      </div>
      <NavLink
        to={ROUTES.orders}
        className={({ isActive }) =>
          `home-nav__item${isActive ? " home-nav__item--active" : ""}`
        }
      >
        <span className="home-nav__ic home-nav__ic--orders" aria-hidden="true">
          <NavIconOrders />
        </span>
        <span className="home-nav__label">My Orders</span>
      </NavLink>
      <NavLink
        to={ROUTES.help}
        className={({ isActive }) =>
          `home-nav__item${isActive ? " home-nav__item--active" : ""}`
        }
      >
        <span className="home-nav__ic" aria-hidden="true">
          <NavIconHelp />
        </span>
        <span className="home-nav__label">Need Help?</span>
      </NavLink>
    </nav>
  );
}
