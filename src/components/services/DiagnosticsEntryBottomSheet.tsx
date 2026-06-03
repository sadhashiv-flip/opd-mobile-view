import { useMemo } from "react";
import bookDiagnosticsSvg from "@/assets/icons/patient-app/hub/services/bookDaignostics.svg";
import healthCheckUpSvg from "@/assets/icons/patient-app/hub/health_check_up.svg";
import freeHealthCheckupSvg from "@/assets/icons/patient-app/hub/free_health_checkup.svg";
import fullySponsoredSvg from "@/assets/icons/patient-app/hub/fully_sponsored.svg";
import {
  ServiceEntryBottomSheet,
  type ServiceEntrySheetItem,
} from "@/components/services/ServiceEntryBottomSheet";

export type DiagnosticsEntryBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  showHealthCheckups: boolean;
  showLabTests: boolean;
  onHealthCheckups: () => void;
  onLabTests: () => void;
}>;

/** Diagnostics hub sheet — aligned with Flutter `ServiceEntryBottomSheets.showDiagnostics`. */
export function DiagnosticsEntryBottomSheet({
  open,
  onClose,
  showHealthCheckups,
  showLabTests,
  onHealthCheckups,
  onLabTests,
}: DiagnosticsEntryBottomSheetProps) {
  const items = useMemo(() => {
    const list: ServiceEntrySheetItem[] = [];
    if (showHealthCheckups) {
      list.push({
        key: "health-checkups",
        iconSrc: bookDiagnosticsSvg,
        title: "Health Checkups",
        subtitle: "Avail Free Health Checkups",
        subtitleIconSrc: freeHealthCheckupSvg,
        onClick: onHealthCheckups,
      });
    }
    if (showLabTests) {
      list.push({
        key: "lab-tests",
        iconSrc: healthCheckUpSvg,
        title: "Lab Tests",
        subtitle: "Fully Sponsored",
        subtitleIconSrc: fullySponsoredSvg,
        onClick: onLabTests,
      });
    }
    return list;
  }, [showHealthCheckups, showLabTests, onHealthCheckups, onLabTests]);

  return (
    <ServiceEntryBottomSheet open={open} onClose={onClose} title="Diagnostics" items={items} />
  );
}
