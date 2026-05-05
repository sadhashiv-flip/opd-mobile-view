/**
 * Home dashboard half-tiles — parity with patient_app {@code ServicesGrid}:
 * fixed order, subscription gates via {@link parseServiceHubTileGates}, max 4 tiles.
 */

import type { ServiceHubTileGates } from "@/lib/moduleGatesFromProfile";

export const DASHBOARD_HALF_TILE_MAX = 4;

export type DashboardHalfTileKind =
  | "consultation"
  | "dental"
  | "pharmacy"
  | "vaccination"
  | "vision"
  | "mental"
  | "chronic"
  | "nutrition"
  | "gym"
  | "claim";

/** Same sequence as {@code service_grid.dart} {@code add(...)} calls. */
export const DASHBOARD_HALF_TILE_ORDER: readonly DashboardHalfTileKind[] = [
  "consultation",
  "dental",
  "pharmacy",
  "vaccination",
  "vision",
  "mental",
  "chronic",
  "nutrition",
  "gym",
  "claim",
] as const;

export const DASHBOARD_HALF_TILE_COPY: Record<
  DashboardHalfTileKind,
  Readonly<{ title: string; meta?: string }>
> = {
  consultation: { title: "Consultation", meta: "BOOK APPOINTMENT" },
  dental: { title: "Dental", meta: "DENTAL BOOKING" },
  pharmacy: { title: "Pharmacy" },
  vaccination: { title: "Vaccination", meta: "BOOK AT HOME / CENTER" },
  vision: { title: "Vision" },
  mental: { title: "Mental Wellness", meta: "BOOK SESSIONS" },
  chronic: { title: "Chronic Management", meta: "MEDICATION & REFILLS" },
  nutrition: { title: "Nutrition", meta: "DIETICIAN SUPPORT" },
  gym: { title: "Gym & Fitness", meta: "MEMBERSHIP" },
  claim: { title: "Claims", meta: "OPD REIMBURSEMENT" },
};

function gateForKind(
  kind: DashboardHalfTileKind,
  hub: ServiceHubTileGates,
): boolean {
  switch (kind) {
    case "consultation":
      return hub.consult;
    case "dental":
      return hub.dental;
    case "pharmacy":
      return hub.pharm;
    case "vaccination":
      return hub.vax;
    case "vision":
      return hub.vision;
    case "mental":
      return hub.mental;
    case "chronic":
      return hub.chronic;
    case "nutrition":
      return hub.nutrition;
    case "gym":
      return hub.gym;
    case "claim":
      return hub.claim;
    default:
      return false;
  }
}

/**
 * First {@link DASHBOARD_HALF_TILE_MAX} eligible tiles in app order.
 * While profile gates are loading, every candidate is treated as visible (optimistic UI).
 */
export function selectDashboardHalfTiles(mod: {
  loaded: boolean;
  serviceHub: ServiceHubTileGates;
}): DashboardHalfTileKind[] {
  const out: DashboardHalfTileKind[] = [];
  for (const kind of DASHBOARD_HALF_TILE_ORDER) {
    if (out.length >= DASHBOARD_HALF_TILE_MAX) break;
    if (!mod.loaded || gateForKind(kind, mod.serviceHub)) {
      out.push(kind);
    }
  }
  return out;
}
