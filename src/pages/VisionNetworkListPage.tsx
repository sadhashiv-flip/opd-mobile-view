import { Navigate, generatePath, useLocation, useParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { ROUTES } from "@/constants";
import { fetchVisionNetworkClinicList, resolveSelectedAddressLocation } from "@/api/networkList";
import {
  resolveVisionBookingContext,
  VISION_SELECTED_CLINIC_KEY,
} from "@/constants/visionBookingStorage";
import { NetworkClinicListView } from "@/pages/NetworkClinicListView";

export function VisionNetworkListPage() {
  const location = useLocation();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim();

  if (visionType !== "eye-checkup" && visionType !== "glasses-lens") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const { flowOption, service } = useMemo(
    () => resolveVisionBookingContext(location.state, visionType),
    [location.state, visionType],
  );

  const title = useMemo(() => {
    if (flowOption === "glasses-lens") return "Select Store";
    if (flowOption === "eye-checkup") return "Select Clinic";
    return "Vision Service";
  }, [flowOption]);

  const fetchClinics = useCallback(async () => {
    const { service: svc } = resolveVisionBookingContext(location.state, visionType);
    if (!svc) return [];
    const loc = await resolveSelectedAddressLocation();
    return fetchVisionNetworkClinicList(loc, svc);
  }, [location.state, visionType]);

  if (!service) {
    return <Navigate to={generatePath(ROUTES.visionSelectPeople, { visionType })} replace />;
  }

  return (
    <NetworkClinicListView
      title={title}
      backTo={generatePath(ROUTES.visionSelectPeople, { visionType })}
      fetchClinics={fetchClinics}
      selectedClinicStorageKey={VISION_SELECTED_CLINIC_KEY}
      continueTo={generatePath(ROUTES.visionSlots, { visionType })}
    />
  );
}
