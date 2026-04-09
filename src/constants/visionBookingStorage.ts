/** Session keys for the vision booking flow (select people → network list → …). */

import type { DentalNetworkClinicRow, VisionNetworkService } from "@/api/networkList";
import type { VisionServiceSlotRow } from "@/api/visionServiceSlots";

export const VISION_FLOW_OPTION_KEY = "opd-mobile-view.vision.flowOption";

export const VISION_SELECTED_CLINIC_KEY = "opd-mobile-view.vision.selectedClinic";

export const VISION_SELECTED_SLOT_KEY = "opd-mobile-view.vision.selectedSlot";

export function readVisionSelectedClinic(): DentalNetworkClinicRow | null {
  try {
    const s = sessionStorage.getItem(VISION_SELECTED_CLINIC_KEY);
    if (!s?.trim()) return null;
    return JSON.parse(s) as DentalNetworkClinicRow;
  } catch {
    return null;
  }
}

export function writeVisionSelectedSlot(row: VisionServiceSlotRow): void {
  try {
    sessionStorage.setItem(VISION_SELECTED_SLOT_KEY, JSON.stringify(row));
  } catch {
    // ignore
  }
}

export function readVisionSelectedSlot(): VisionServiceSlotRow | null {
  try {
    const s = sessionStorage.getItem(VISION_SELECTED_SLOT_KEY);
    if (!s?.trim()) return null;
    return JSON.parse(s) as VisionServiceSlotRow;
  } catch {
    return null;
  }
}

/** Home / select-people route state — drives API `service=vision.clinic` vs `vision.store`. */
export type VisionSheetOption = "eye-checkup" | "glasses-lens";

function parseVisionOptionFromNavState(nav: unknown): VisionSheetOption | null {
  if (!nav || typeof nav !== "object") return null;
  const v = (nav as { visionOption?: unknown }).visionOption;
  return v === "eye-checkup" || v === "glasses-lens" ? v : null;
}

function isVisionSheetOptionString(v: string | undefined | null): v is VisionSheetOption {
  return v === "eye-checkup" || v === "glasses-lens";
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
 * Resolves vision flow from the URL segment `/:visionType` first (same idea as consultation `/:type`),
 * then `location.state`, then sessionStorage.
 */
export function resolveVisionBookingContext(
  navState: unknown,
  visionTypeFromPath?: string | null,
): Readonly<{
  flowOption: VisionSheetOption | null;
  service: VisionNetworkService | null;
}> {
  const trimmed = visionTypeFromPath?.trim();
  if (trimmed && isVisionSheetOptionString(trimmed)) {
    try {
      sessionStorage.setItem(VISION_FLOW_OPTION_KEY, trimmed);
    } catch {
      // ignore
    }
    return { flowOption: trimmed, service: toApiService(trimmed) };
  }
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
