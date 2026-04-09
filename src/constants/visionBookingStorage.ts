/** Session keys for the vision booking flow (select people → network list → …). */

import type { VisionNetworkService } from "@/api/networkList";

export const VISION_FLOW_OPTION_KEY = "opd-mobile-view.vision.flowOption";

export const VISION_SELECTED_CLINIC_KEY = "opd-mobile-view.vision.selectedClinic";

/** Home / select-people route state — drives API `service=vision.clinic` vs `vision.store`. */
export type VisionSheetOption = "eye-checkup" | "glasses-lens";

function parseVisionOptionFromNavState(nav: unknown): VisionSheetOption | null {
  if (!nav || typeof nav !== "object") return null;
  const v = (nav as { visionOption?: unknown }).visionOption;
  return v === "eye-checkup" || v === "glasses-lens" ? v : null;
}

export function readVisionFlowOptionFromStorage(): VisionSheetOption | null {
  try {
    const t = sessionStorage.getItem(VISION_FLOW_OPTION_KEY)?.trim();
    return t === "eye-checkup" || t === "glasses-lens" ? t : null;
  } catch {
    return null;
  }
}

function toApiService(opt: VisionSheetOption | null): VisionNetworkService | null {
  if (opt === "eye-checkup") return "vision.clinic";
  if (opt === "glasses-lens") return "vision.store";
  return null;
}

/**
 * Resolves vision flow from React Router `location.state` first, then sessionStorage.
 * When `location.state` carries `visionOption`, it is written to session (same tick as render
 * so child effects that load clinics see a consistent service key).
 */
export function resolveVisionBookingContext(navState: unknown): Readonly<{
  flowOption: VisionSheetOption | null;
  service: VisionNetworkService | null;
}> {
  const fromNav = parseVisionOptionFromNavState(navState);
  if (fromNav) {
    try {
      sessionStorage.setItem(VISION_FLOW_OPTION_KEY, fromNav);
    } catch {
      // ignore
    }
    return { flowOption: fromNav, service: toApiService(fromNav) };
  }
  const fromStore = readVisionFlowOptionFromStorage();
  return { flowOption: fromStore, service: toApiService(fromStore) };
}
