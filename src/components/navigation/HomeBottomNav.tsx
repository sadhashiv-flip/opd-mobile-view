import {
  NavIconHelp,
  NavIconHome,
  NavIconMedicalRecords,
  NavIconOrders,
  NavIconServices,
} from "@/assets/icons/react";
import { ROUTES } from "@/constants";
import { DEFAULT_MEDICAL_RECORD_SLUG } from "@/constants/medicalRecordsCategories";
import {
  isHelpBottomNavRoute,
  isMedicalRecordsBottomNavRoute,
  isServicesBottomNavRoute,
} from "@/lib/bottomNavActive";
import type { ReactNode } from "react";
import { generatePath, NavLink, useLocation } from "react-router-dom";
import "./HomeBottomNav.css";

/** Flat bar fill — patient-app `AnimatedBottomNavigationBar` (60px, no center FAB). */
const HOME_NAV_BAR_FILL_D = "M0,60 L0,0 L430,0 L430,60 Z";

function navItemClass(isActive: boolean): string {
  return `home-nav__item${isActive ? " home-nav__item--active" : ""}`;
}

type HomeBottomNavProps = Readonly<{
  /**
   * When false, the bar slides off-screen (patient-app `DashboardMainScreen` scroll behavior on the home shell).
   * Other screens omit this prop so the bar stays visible.
   */
  visible?: boolean;
  /** Optional slot pinned above the bar (home ongoing orders — Flutter `DashboardMainScreen` column). */
  aboveBar?: ReactNode;
}>;

/**
 * Bottom tab bar: My Orders, Services, Home, My Records, Need Help?
 * Matches patient-app `DashboardMainScreen` — five equal tabs on a flat white bar.
 */
export function HomeBottomNav({ visible = true, aboveBar }: HomeBottomNavProps) {
  const { pathname, search } = useLocation();
  const servicesActive = isServicesBottomNavRoute(pathname, search);
  const helpActive = isHelpBottomNavRoute(pathname, search);
  const recordsActive = isMedicalRecordsBottomNavRoute(pathname, search);
  const stacked = aboveBar != null;

  return (
    <>
      {stacked ? <div className="home-nav-dock-spacer" aria-hidden="true" /> : null}
      <div
        className={`home-nav-shell${visible ? "" : " home-nav-shell--hidden"}${stacked ? " home-nav-shell--stacked" : ""}`}
      >
        {stacked ? <div className="home-nav-shell__above">{aboveBar}</div> : null}
        {!stacked ? <div className="home-nav-spacer" aria-hidden="true" /> : null}
        <nav className="home-nav" aria-label="Primary">
        <div className="home-nav__plate">
          <svg
            className="home-nav__shape"
            viewBox="0 0 430 60"
            preserveAspectRatio="xMidYMax meet"
            aria-hidden="true"
          >
            <path fill="var(--home-nav-bar-fill)" d={HOME_NAV_BAR_FILL_D} />
          </svg>
          <div className="home-nav__inner">
            <NavLink
              to={ROUTES.orders}
              id="tour-home-nav-orders"
              className={({ isActive }) => navItemClass(isActive)}
            >
              <span className="home-nav__ic home-nav__ic--orders" aria-hidden="true">
                <NavIconOrders />
              </span>
              <span className="home-nav__label">My Orders</span>
            </NavLink>

            <NavLink
              to={ROUTES.services}
              id="tour-home-nav-services"
              end
              className={() => navItemClass(servicesActive)}
            >
              <span className="home-nav__ic" aria-hidden="true">
                <NavIconServices />
              </span>
              <span className="home-nav__label">Services</span>
            </NavLink>

            <NavLink
              to={ROUTES.dashboard}
              id="tour-home-nav-home"
              end
              className={({ isActive }) => navItemClass(isActive)}
            >
              <span className="home-nav__ic" aria-hidden="true">
                <NavIconHome />
              </span>
              <span className="home-nav__label">Home</span>
            </NavLink>

            <NavLink
              to={generatePath(ROUTES.medicalRecordsCategory, {
                categorySlug: DEFAULT_MEDICAL_RECORD_SLUG,
              })}
              id="tour-home-nav-records"
              className={() => navItemClass(recordsActive)}
              aria-label="My Records"
              title="My Records"
            >
              <span className="home-nav__ic home-nav__ic--medical" aria-hidden="true">
                <NavIconMedicalRecords />
              </span>
              <span className="home-nav__label home-nav__label--medical">My Records</span>
            </NavLink>

            <NavLink
              to={ROUTES.servicesHelpSupport}
              state={{ fromBottomNav: true }}
              id="tour-home-nav-help"
              className={() => navItemClass(helpActive)}
            >
              <span className="home-nav__ic" aria-hidden="true">
                <NavIconHelp />
              </span>
              <span className="home-nav__label">Need Help?</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
    </>
  );
}
