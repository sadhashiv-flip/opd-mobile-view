import { ROUTES } from "@/constants";
import { Navigate, generatePath, useLocation } from "react-router-dom";

/**
 * Canonical entry is `/diagnostics/health-checkups` → select-people (`SelectPeopleFlowPage` in
 * `ConsultationSelectPeoplePage.tsx`) with patient_app parity: address, single member, AHC query flags, etc.
 */
export function HealthCheckupsPage() {
  const location = useLocation();
  const target = `${generatePath(ROUTES.diagnosticsSelectPeople, { type: "health-checkups" })}${location.search}`;
  return <Navigate to={target} replace />;
}
