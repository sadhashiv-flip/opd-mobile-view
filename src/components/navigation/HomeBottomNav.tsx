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
import { useId, type ReactNode } from "react";
import { generatePath, NavLink, useLocation } from "react-router-dom";
import "./HomeBottomNav.css";

/**
 * Rounded bar outline only (viewBox `0 0 430 76`). The FAB notch is cut with an SVG `<mask>`
 * (black circle = transparent). Avoid `feDropShadow` on even-odd “hole” paths — it often fills
 * the notch with white in WebKit/Blink.
 */
const HOME_NAV_BAR_FILL_D =
  "M0,76 L0,34 Q0,14 22,14 L408,14 Q430,14 430,34 L430,76 Z";

const NOTCH_MASK = { cx: 215, cy: 14, r: 36 } as const;

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
 * Bottom tab bar: My Orders, Services, Home FAB, Need Help?, Medical Records.
 * Curved bar with notched “cradle” around Home (transparent gap); solid white bar.
 */
export function HomeBottomNav({ visible = true, aboveBar }: HomeBottomNavProps) {
  const uid = useId().replace(/:/g, "");
  const notchMaskId = `home-nav-notch-${uid}`;
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
            viewBox="0 0 430 76"
            preserveAspectRatio="xMidYMax meet"
            aria-hidden="true"
          >
            <defs>
              <mask
                id={notchMaskId}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="430"
                height="76"
              >
                <rect width="430" height="76" fill="white" />
                <circle
                  cx={NOTCH_MASK.cx}
                  cy={NOTCH_MASK.cy}
                  r={NOTCH_MASK.r}
                  fill="black"
                />
              </mask>
            </defs>
            <path
              fill="var(--home-nav-bar-fill)"
              mask={`url(#${notchMaskId})`}
              d={HOME_NAV_BAR_FILL_D}
            />
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

            <div className="home-nav__fab-wrap">
              <NavLink
                to={ROUTES.dashboard}
                id="tour-home-nav-home"
                end
                className={({ isActive }) =>
                  `home-nav__fab${isActive ? " home-nav__fab--active" : ""}`
                }
                aria-label="Home"
              >
                <span className="home-nav__fab-icon" aria-hidden="true">
                  <NavIconHome />
                </span>
              </NavLink>
              <span className="home-nav__fab-label-spacer" aria-hidden="true" />
            </div>

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
