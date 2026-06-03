import { ROUTES } from "@/constants";

function isServicesHubPath(pathname: string): boolean {
  return pathname === ROUTES.services || pathname.startsWith(`${ROUTES.services}/`);
}

/** Help & Support — bottom nav “Need Help?”. */
export function isHelpBottomNavRoute(pathname: string, search: string): boolean {
  if (
    pathname === ROUTES.servicesHelpSupport ||
    pathname.startsWith(`${ROUTES.servicesHelpSupport}/`)
  ) {
    return true;
  }
  if (pathname.startsWith(`${ROUTES.services}/support/`)) return true;
  if (pathname === ROUTES.services) {
    return new URLSearchParams(search).get("tab") === "help";
  }
  return false;
}

/** Medical records — bottom nav “My Records”. */
export function isMedicalRecordsBottomNavRoute(pathname: string, search: string): boolean {
  if (pathname === ROUTES.medicalRecords || pathname.startsWith(`${ROUTES.medicalRecords}/`)) {
    return true;
  }
  if (pathname === ROUTES.services) {
    return new URLSearchParams(search).get("tab") === "medical-records";
  }
  return false;
}

/** Services hub and flows — bottom nav “Services” (not help or medical records). */
export function isServicesBottomNavRoute(pathname: string, search: string): boolean {
  if (isHelpBottomNavRoute(pathname, search) || isMedicalRecordsBottomNavRoute(pathname, search)) {
    return false;
  }
  return isServicesHubPath(pathname);
}
