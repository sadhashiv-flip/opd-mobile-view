import type { DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";

/** Full slot object for `POST /diagnostics/order/booking` (Individual Lab Tests flow). */
export const DIAG_LAB_SLOT_PAYLOAD_KEY = "opd-mobile-view.diagnostics.slotPayload";

export const DIAG_LAB_VENDOR_CODE_KEY = "opd-mobile-view.diagnostics.vendorCode";

export const DIAG_LAB_VENDOR_NAME_KEY = "opd-mobile-view.diagnostics.vendorDisplayName";

/** `package` body field for `POST /diagnostics/slots` in Individual Lab Tests flow (Postman). */
export const DIAG_LAB_SLOTS_PACKAGE = "test";

export function parseLabSlotPayload(raw: string | null): DiagnosticSlotPick | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const o = p as Record<string, unknown>;
    const slot_id = String(o.slot_id ?? "");
    const vendor_code = String(o.vendor_code ?? "");
    const slot_date = String(o.slot_date ?? "");
    const start_time = String(o.start_time ?? "");
    const end_time = String(o.end_time ?? "");
    if (!slot_id || !vendor_code || !slot_date || !start_time) return null;
    return { slot_id, vendor_code, slot_date, start_time, end_time };
  } catch {
    return null;
  }
}

export function readLabSlotPayload(): DiagnosticSlotPick | null {
  try {
    return parseLabSlotPayload(localStorage.getItem(DIAG_LAB_SLOT_PAYLOAD_KEY));
  } catch {
    return null;
  }
}

export function writeLabSlotPayload(pick: DiagnosticSlotPick): void {
  try {
    localStorage.setItem(DIAG_LAB_SLOT_PAYLOAD_KEY, JSON.stringify(pick));
    localStorage.setItem("opd-mobile-view.diagnostics.date", pick.slot_date);
    localStorage.setItem("opd-mobile-view.diagnostics.slotId", pick.slot_id);
    localStorage.setItem(
      "opd-mobile-view.diagnostics.slotLabel",
      `${pick.start_time} – ${pick.end_time}`,
    );
  } catch {
    // ignore
  }
}

export function clearLabSlotPayload(): void {
  try {
    localStorage.removeItem(DIAG_LAB_SLOT_PAYLOAD_KEY);
    localStorage.removeItem("opd-mobile-view.diagnostics.date");
    localStorage.removeItem("opd-mobile-view.diagnostics.slotId");
    localStorage.removeItem("opd-mobile-view.diagnostics.slotLabel");
  } catch {
    // ignore
  }
}

export function readLabVendorCode(): string {
  try {
    return localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeLabVendorSelection(code: string, displayName = ""): void {
  try {
    localStorage.setItem(DIAG_LAB_VENDOR_CODE_KEY, code);
    localStorage.setItem(DIAG_LAB_VENDOR_NAME_KEY, displayName);
    localStorage.setItem("opd-mobile-view.diagnostics.vendorId", code);
    localStorage.setItem("opd-mobile-view.diagnostics.vendorMode", "home");
  } catch {
    // ignore
  }
}

export function clearLabVendorSelection(): void {
  try {
    localStorage.removeItem(DIAG_LAB_VENDOR_CODE_KEY);
    localStorage.removeItem(DIAG_LAB_VENDOR_NAME_KEY);
    localStorage.removeItem("opd-mobile-view.diagnostics.vendorId");
    localStorage.removeItem("opd-mobile-view.diagnostics.vendorMode");
  } catch {
    // ignore
  }
}
