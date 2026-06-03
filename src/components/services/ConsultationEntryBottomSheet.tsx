import { useMemo } from "react";
import bookConsultationsSvg from "@/assets/icons/patient-app/hub/services/bookConsultations.svg";
import virtualCardSvg from "@/assets/icons/patient-app/hub/virtualCardDashbaord.svg";
import freeHealthCheckupSvg from "@/assets/icons/patient-app/hub/free_health_checkup.svg";
import {
  ServiceEntryBottomSheet,
  type ServiceEntrySheetItem,
} from "@/components/services/ServiceEntryBottomSheet";

export type ConsultationEntryBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  showAtHospital: boolean;
  showVirtual: boolean;
  onAtHospital: () => void;
  onVirtual: () => void;
}>;

/** Consultation hub sheet — aligned with Flutter `ServiceEntryBottomSheets.showConsultation`. */
export function ConsultationEntryBottomSheet({
  open,
  onClose,
  showAtHospital,
  showVirtual,
  onAtHospital,
  onVirtual,
}: ConsultationEntryBottomSheetProps) {
  const items = useMemo(() => {
    const list: ServiceEntrySheetItem[] = [];
    if (showAtHospital) {
      list.push({
        key: "at-hospital",
        iconSrc: bookConsultationsSvg,
        title: "At Hospital",
        subtitle: "Book Your OPD Consultations Here",
        subtitleIconSrc: freeHealthCheckupSvg,
        onClick: onAtHospital,
      });
    }
    if (showVirtual) {
      list.push({
        key: "virtual",
        iconSrc: virtualCardSvg,
        title: "Virtual",
        subtitle: "Connecting Care, Virtually Everywhere",
        subtitleIconSrc: freeHealthCheckupSvg,
        onClick: onVirtual,
      });
    }
    return list;
  }, [showAtHospital, showVirtual, onAtHospital, onVirtual]);

  return (
    <ServiceEntryBottomSheet open={open} onClose={onClose} title="Consultation" items={items} />
  );
}
