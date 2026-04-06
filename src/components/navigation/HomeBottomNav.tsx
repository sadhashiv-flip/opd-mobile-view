import {
  NavIconHelp,
  NavIconHome,
  NavIconOrders,
  NavIconPharmacyFab,
  NavIconServices,
} from "@/assets/icons/react";
import { ROUTES } from "@/constants";
import { NavLink, useLocation } from "react-router-dom";
import "./HomeBottomNav.css";

function useServicesHubBottomNavActive(): Readonly<{ services: boolean; help: boolean }> {
  const { pathname, search } = useLocation();
  const onHub = pathname === ROUTES.services;
  const hubTab = onHub ? new URLSearchParams(search).get("tab") : null;
  const help = onHub && hubTab === "help";
  const services =
    (onHub && hubTab !== "help") || (!onHub && pathname.startsWith(`${ROUTES.services}/`));
  return { services, help };
}

/** Bottom tab bar — matches mobile spec: outline icons, orange active, raised Pharmacy FAB. */
export function HomeBottomNav() {
  const { services: servicesTabActive, help: helpTabActive } = useServicesHubBottomNavActive();

  return (
    <>
      <div className="home-nav-spacer" aria-hidden="true" />
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
        className={() => `home-nav__item${servicesTabActive ? " home-nav__item--active" : ""}`}
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
        to={ROUTES.servicesHelpTab}
        className={() => `home-nav__item${helpTabActive ? " home-nav__item--active" : ""}`}
      >
        <span className="home-nav__ic" aria-hidden="true">
          <NavIconHelp />
        </span>
        <span className="home-nav__label">Need Help?</span>
      </NavLink>
    </nav>
    </>
  );
}
