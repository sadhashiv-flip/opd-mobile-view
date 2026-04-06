import { Navigate, generatePath, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";

export function DiagnosticsEntryRedirect() {
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  return <Navigate to={generatePath(ROUTES.diagnosticsSelectPeople, { type })} replace />;
}
