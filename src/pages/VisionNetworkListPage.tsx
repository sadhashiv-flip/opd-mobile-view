import { Navigate, useLocation } from "react-router-dom";
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

  const { flowOption, service } = useMemo(
    () => resolveVisionBookingContext(location.state),
    [location.state],
  );

  const title = useMemo(() => {
    if (flowOption === "glasses-lens") return "Select Store";
    if (flowOption === "eye-checkup") return "Select Clinic";
    return "Vision Service";
  }, [flowOption]);

  const fetchClinics = useCallback(async () => {
    const { service: svc } = resolveVisionBookingContext(location.state);
    if (!svc) return [];
    const loc = await resolveSelectedAddressLocation();
    return fetchVisionNetworkClinicList(loc, svc);
  }, [location.state]);

  if (!service) {
    return <Navigate to={ROUTES.visionSelectPeople} replace />;
  }

  return (
    <NetworkClinicListView
      title={title}
      backTo={ROUTES.visionSelectPeople}
      fetchClinics={fetchClinics}
      selectedClinicStorageKey={VISION_SELECTED_CLINIC_KEY}
      continueTo={ROUTES.vision}
    />
  );
}
