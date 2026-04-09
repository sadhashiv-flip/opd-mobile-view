import {
  NavIconHelp,
  NavIconHome,
  NavIconMedicalRecords,
  NavIconOrders,
  NavIconServices,
} from "@/assets/icons/react";
import { ROUTES } from "@/constants";
import { useId } from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./HomeBottomNav.css";

/**
 * Rounded bar outline only (viewBox `0 0 430 76`). The FAB notch is cut with an SVG `<mask>`
 * (black circle = transparent). Avoid `feDropShadow` on even-odd “hole” paths — it often fills
 * the notch with white in WebKit/Blink.
 */
const HOME_NAV_BAR_FILL_D =
  "M0,76 L0,34 Q0,14 22,14 L408,14 Q430,14 430,34 L430,76 Z";

const NOTCH_MASK = { cx: 215, cy: 14, r: 36 } as const;

function useHubBottomNavActive(): Readonly<{
  services: boolean;
  help: boolean;
  medicalRecords: boolean;
}> {
  const { pathname, search } = useLocation();
  const onHub = pathname === ROUTES.services;
  const tab = onHub ? new URLSearchParams(search).get("tab") : null;
  const help = tab === "help";
  const medicalRecords = tab === "medical-records";
  const onServicesSubpath = pathname.startsWith(`${ROUTES.services}/`);
  const services =
    (onHub && (tab === null || tab === "services")) || onServicesSubpath;
  return { services, help, medicalRecords };
}

/**
 * Bottom tab bar: My Orders, Services, Home FAB, Need Help?, Medical Records.
 * Curved bar with notched “cradle” around Home (transparent gap); solid white bar.
 */
export function HomeBottomNav() {
  const { services: servicesTabActive, help: helpTabActive, medicalRecords: medicalTabActive } =
    useHubBottomNavActive();
  const uid = useId().replace(/:/g, "");
  const notchMaskId = `home-nav-notch-${uid}`;

  return (
    <>
      <div className="home-nav-spacer" aria-hidden="true" />
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
              to={ROUTES.services}
              className={() =>
                `home-nav__item${servicesTabActive ? " home-nav__item--active" : ""}`
              }
            >
              <span className="home-nav__ic" aria-hidden="true">
                <NavIconServices />
              </span>
              <span className="home-nav__label">Services</span>
            </NavLink>

            <div className="home-nav__fab-wrap">
              <NavLink
                to={ROUTES.dashboard}
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
              to={ROUTES.servicesMedicalRecordsTab}
              className={() =>
                `home-nav__item${medicalTabActive ? " home-nav__item--active" : ""}`
              }
              aria-label="Medical Records"
              title="Medical Records"
            >
              <span className="home-nav__ic" aria-hidden="true">
                <NavIconMedicalRecords />
              </span>
              <span className="home-nav__label home-nav__label--medical">Medical Rec…</span>
            </NavLink>

            <NavLink
              to={ROUTES.servicesHelpTab}
              className={() =>
                `home-nav__item${helpTabActive ? " home-nav__item--active" : ""}`
              }
            >
              <span className="home-nav__ic" aria-hidden="true">
                <NavIconHelp />
              </span>
              <span className="home-nav__label">Need Help?</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </>
  );
}
