import type { DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { parseLabSlotPayload } from "@/constants/diagnosticsLabFlowStorage";

/** Health checkup (AHC / special packages) flow — mirrors patient_app sponsored pricing + multi-slot booking. */

export const DIAG_HEALTH_USERS_PACKAGES_KEY = "opd-mobile-view.diagnostics.health.usersPackages";
/** Draft package picks on the plan screen (`memberId` → package ids) before Continue. */
export const DIAG_HEALTH_PKG_DRAFT_KEY = "opd-mobile-view.diagnostics.health.pkgDraft";
export const DIAG_HEALTH_SPONSORED_KEY = "opd-mobile-view.diagnostics.health.sponsored";
/** JSON: { needPathology: boolean; needRadiology: boolean; pathVendorCode: string; radVendorCode: string } */
export const DIAG_HEALTH_VENDOR_META_KEY = "opd-mobile-view.diagnostics.health.vendorMeta";
/** In-progress pathology / radiology vendor picks on the vendor screen (restored on back). */
export const DIAG_HEALTH_VENDOR_DRAFT_KEY = "opd-mobile-view.diagnostics.health.vendorDraft";
export const DIAG_HEALTH_PATH_SLOT_KEY = "opd-mobile-view.diagnostics.health.pathologySlot";
export const DIAG_HEALTH_RAD_SLOT_KEY = "opd-mobile-view.diagnostics.health.radiologySlot";
export const DIAG_HEALTH_SLOT_PHASE_KEY = "opd-mobile-view.diagnostics.health.slotPhase";

/** `package` value for `POST /diagnostics/slots` in health checkup flow (patient_app). */
export const DIAG_HEALTH_SLOTS_PACKAGE = "special";

export type HealthUserPackageRow = Readonly<{
  user_id: number;
  packages: readonly number[];
}>;

export type HealthVendorMeta = Readonly<{
  needPathology: boolean;
  needRadiology: boolean;
  pathVendorCode: string;
  radVendorCode: string;
}>;

export function readHealthSponsoredFlag(): boolean {
  try {
    return globalThis.localStorage?.getItem(DIAG_HEALTH_SPONSORED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHealthSponsoredFlag(value: boolean): void {
  try {
    globalThis.localStorage?.setItem(DIAG_HEALTH_SPONSORED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

export function writeHealthUsersPackages(rows: readonly HealthUserPackageRow[]): void {
  try {
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_USERS_PACKAGES_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

export function readHealthPackageDraft(): Record<string, number[]> {
  try {
    const raw = globalThis.sessionStorage?.getItem(DIAG_HEALTH_PKG_DRAFT_KEY);
    if (!raw?.trim()) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    const out: Record<string, number[]> = {};
    for (const [memberId, pkgs] of Object.entries(p as Record<string, unknown>)) {
      if (!memberId.trim() || !Array.isArray(pkgs)) continue;
      const packages: number[] = [];
      for (const x of pkgs) {
        const n = typeof x === "number" ? x : Number(x);
        if (Number.isFinite(n) && n > 0) packages.push(n);
      }
      if (packages.length > 0) out[memberId] = packages;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeHealthPackageDraft(draft: Record<string, number[]>): void {
  try {
    const keys = Object.keys(draft);
    if (keys.length === 0) {
      globalThis.sessionStorage?.removeItem(DIAG_HEALTH_PKG_DRAFT_KEY);
      return;
    }
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_PKG_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function readHealthUsersPackages(): HealthUserPackageRow[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(DIAG_HEALTH_USERS_PACKAGES_KEY);
    if (!raw?.trim()) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    const out: HealthUserPackageRow[] = [];
    for (const row of p) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const uid = typeof o.user_id === "number" ? o.user_id : Number(o.user_id);
      if (!Number.isFinite(uid) || uid <= 0) continue;
      const pkgs = o.packages;
      const packages: number[] = [];
      if (Array.isArray(pkgs)) {
        for (const x of pkgs) {
          const n = typeof x === "number" ? x : Number(x);
          if (Number.isFinite(n) && n > 0) packages.push(n);
        }
      }
      if (packages.length === 0) continue;
      out.push({ user_id: uid, packages });
    }
    return out;
  } catch {
    return [];
  }
}

export function writeHealthVendorMeta(meta: HealthVendorMeta): void {
  try {
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_VENDOR_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function readHealthVendorMeta(): HealthVendorMeta | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(DIAG_HEALTH_VENDOR_META_KEY);
    if (!raw?.trim()) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      needPathology: o.needPathology === true,
      needRadiology: o.needRadiology === true,
      pathVendorCode: typeof o.pathVendorCode === "string" ? o.pathVendorCode : "unknown",
      radVendorCode: typeof o.radVendorCode === "string" ? o.radVendorCode : "unknown",
    };
  } catch {
    return null;
  }
}

export function writeHealthPathologySlotJson(json: string): void {
  try {
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_PATH_SLOT_KEY, json);
  } catch {
    // ignore
  }
}

export function writeHealthRadiologySlotJson(json: string): void {
  try {
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_RAD_SLOT_KEY, json);
  } catch {
    // ignore
  }
}

export function readHealthPathologySlotJson(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(DIAG_HEALTH_PATH_SLOT_KEY);
  } catch {
    return null;
  }
}

export function readHealthRadiologySlotJson(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(DIAG_HEALTH_RAD_SLOT_KEY);
  } catch {
    return null;
  }
}

export type HealthVendorDraft = Readonly<{
  pathVendorCode: string | null;
  radVendorCode: string | null;
}>;

export function readHealthVendorDraft(): HealthVendorDraft | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(DIAG_HEALTH_VENDOR_DRAFT_KEY);
    if (!raw?.trim()) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const path =
      typeof o.pathVendorCode === "string" ? o.pathVendorCode.trim() || null : null;
    const rad =
      typeof o.radVendorCode === "string" ? o.radVendorCode.trim() || null : null;
    if (!path && !rad) return null;
    return { pathVendorCode: path, radVendorCode: rad };
  } catch {
    return null;
  }
}

export function writeHealthVendorDraft(draft: HealthVendorDraft): void {
  try {
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_VENDOR_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export type HealthSlotPhase = "pathology" | "radiology";

export function readHealthSlotPhase(): HealthSlotPhase | null {
  try {
    const v = globalThis.sessionStorage?.getItem(DIAG_HEALTH_SLOT_PHASE_KEY)?.trim();
    if (v === "pathology" || v === "radiology") return v;
    return null;
  } catch {
    return null;
  }
}

export function writeHealthSlotPhase(phase: HealthSlotPhase): void {
  try {
    globalThis.sessionStorage?.setItem(DIAG_HEALTH_SLOT_PHASE_KEY, phase);
  } catch {
    // ignore
  }
}

export function clearHealthSlotPicks(): void {
  try {
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_PATH_SLOT_KEY);
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_RAD_SLOT_KEY);
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_SLOT_PHASE_KEY);
  } catch {
    // ignore
  }
}

/** Clears all in-progress health checkup (AHC) flow storage. */
export function clearDiagnosticsHealthFlowStorage(): void {
  writeHealthPackageDraft({});
  clearHealthSlotPicks();
  try {
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_USERS_PACKAGES_KEY);
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_VENDOR_META_KEY);
    globalThis.sessionStorage?.removeItem(DIAG_HEALTH_VENDOR_DRAFT_KEY);
    globalThis.localStorage?.removeItem(DIAG_HEALTH_SPONSORED_KEY);
  } catch {
    // ignore
  }
}

export function readHealthPathologySlotPick(): DiagnosticSlotPick | null {
  return parseLabSlotPayload(readHealthPathologySlotJson());
}

export function readHealthRadiologySlotPick(): DiagnosticSlotPick | null {
  return parseLabSlotPayload(readHealthRadiologySlotJson());
}
