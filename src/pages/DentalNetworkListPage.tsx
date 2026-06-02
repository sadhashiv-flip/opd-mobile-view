import { useCallback } from "react";
import { ROUTES } from "@/constants";
import {
  fetchDentalNetworkClinicList,
  resolveSelectedAddressLocation,
} from "@/api/networkList";
import {
  clearDentalClinicAndDownstream,
  DENTAL_SELECTED_CLINIC_KEY,
} from "@/constants/dentalBookingStorage";
import { NetworkClinicListView } from "@/pages/NetworkClinicListView";

export function DentalNetworkListPage() {
  const fetchClinics = useCallback(async () => {
    const loc = await resolveSelectedAddressLocation();
    return fetchDentalNetworkClinicList(loc);
  }, []);

  return (
    <NetworkClinicListView
      title="Dental Service"
      backTo={ROUTES.dentalSelectPeople}
      fetchClinics={fetchClinics}
      selectedClinicStorageKey={DENTAL_SELECTED_CLINIC_KEY}
      continueTo={ROUTES.dentalSlots}
      onBeforeBack={clearDentalClinicAndDownstream}
    />
  );
}
