import { Navigate, generatePath, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";

export function ConsultationEntryRedirect() {
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "virtual";
  return <Navigate to={generatePath(ROUTES.consultationSelectPeople, { type })} replace />;
}

