import { clearLabSlotPayload, clearLabVendorSelection } from "@/constants/diagnosticsLabFlowStorage";
import { clearDiagnosticsHealthFlowStorage } from "@/constants/diagnosticsHealthFlowStorage";
import { writeConsultSelectedPersonIds } from "@/constants/consultationSelectedMemberStorage";
import { writeDiagnosticsSelectedPersonIds } from "@/constants/diagnosticsSelectedMemberStorage";
import { writeSelectPeoplePickerIds } from "@/constants/selectPeoplePickerStorage";
import { clearPharmacyFlipRxSelection } from "@/constants/pharmacyFlipRxSelectionStorage";

export function clearSelectPeoplePickerForScope(
  pickerScope: string,
  flow: "consultation" | "diagnostics" | "dental" | "vision" | "vaccination",
): void {
  writeSelectPeoplePickerIds(pickerScope, []);
  if (flow === "consultation") {
    writeConsultSelectedPersonIds([]);
  } else if (flow === "diagnostics" || flow === "dental" || flow === "vision") {
    writeDiagnosticsSelectedPersonIds([]);
  }
}

export function clearDiagnosticsLabPickerDrafts(): void {
  clearLabSlotPayload();
  clearLabVendorSelection();
}

export function clearDiagnosticsHealthPickerDrafts(): void {
  clearDiagnosticsHealthFlowStorage();
}

export function clearPharmacyPickerDrafts(): void {
  clearPharmacyFlipRxSelection();
}
