/** Session keys for the vision booking flow (select people → network list → …). */

import type { DentalNetworkClinicRow, VisionNetworkService } from "@/api/networkList";
import type { VisionServiceSlotRow } from "@/api/visionServiceSlots";

export const VISION_FLOW_OPTION_KEY = "opd-mobile-view.vision.flowOption";

export const VISION_SELECTED_CLINIC_KEY = "opd-mobile-view.vision.selectedClinic";

export const VISION_SELECTED_SLOT_KEY = "opd-mobile-view.vision.selectedSlot";

/** Glasses/lens: attachment ids from `POST /upload` after add-prescription step (before overview). */
export const VISION_GLASSES_PRESCRIPTIONS_KEY = "opd-mobile-view.vision.glasses.prescriptions";

export type VisionGlassesPrescriptionStored = Readonly<{
  attachmentId: string;
  title: string;
  uploadedAt: string;
  /** Relative path from upload `data.path` — preview via `VITE_IMAGE_URL`. */
  path?: string;
  /** Upload `data.type`, e.g. `IMG`, `PDF`. */
  type?: string;
}>;

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

export function writeVisionGlassesPrescriptions(items: readonly VisionGlassesPrescriptionStored[]): void {
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(VISION_GLASSES_PRESCRIPTIONS_KEY);
      return;
    }
    sessionStorage.setItem(VISION_GLASSES_PRESCRIPTIONS_KEY, JSON.stringify([...items]));
  } catch {
    // ignore
  }
}

export function readVisionGlassesPrescriptions(): VisionGlassesPrescriptionStored[] {
  try {
    const raw = sessionStorage.getItem(VISION_GLASSES_PRESCRIPTIONS_KEY);
    if (!raw?.trim()) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    const out: VisionGlassesPrescriptionStored[] = [];
    for (const row of p) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      let attachmentId = "";
      if (typeof r.attachmentId === "string") {
        attachmentId = r.attachmentId.trim();
      } else if (typeof r.id === "string") {
        attachmentId = r.id.trim();
      }
      if (!attachmentId) continue;
      const title = typeof r.title === "string" ? r.title : "";
      const uploadedAt = typeof r.uploadedAt === "string" ? r.uploadedAt : "";
      const path = typeof r.path === "string" && r.path.trim() ? r.path.trim() : undefined;
      const type = typeof r.type === "string" && r.type.trim() ? r.type.trim() : undefined;
      out.push({ attachmentId, title, uploadedAt, path, type });
    }
    return out;
  } catch {
    return [];
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

export function clearVisionSelectedSlot(): void {
  try {
    sessionStorage.removeItem(VISION_SELECTED_SLOT_KEY);
  } catch {
    // ignore
  }
}

/** Back from slots / add-prescription → network list — drop slot & Rx; clinic stays. */
export function clearVisionSlotAndDownstream(): void {
  clearVisionSelectedSlot();
  try {
    sessionStorage.removeItem(VISION_GLASSES_PRESCRIPTIONS_KEY);
  } catch {
    // ignore
  }
}

/** Back from network list → select people — drop clinic, slot, and Rx picks. */
export function clearVisionClinicAndDownstream(): void {
  try {
    sessionStorage.removeItem(VISION_SELECTED_CLINIC_KEY);
  } catch {
    // ignore
  }
  clearVisionSlotAndDownstream();
}

export function clearVisionBookingFlowState(): void {
  try {
    sessionStorage.removeItem(VISION_FLOW_OPTION_KEY);
  } catch {
    // ignore
  }
  clearVisionClinicAndDownstream();
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
