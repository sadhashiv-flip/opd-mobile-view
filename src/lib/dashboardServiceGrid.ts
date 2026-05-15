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

/** Feature chip on a half-tile — `ServiceFeature` / `service_grid.dart`. */
export type DashboardHalfTileFeature = Readonly<{
  label: string;
  icon?: "virtual" | "at-hospital";
  tone?: "green" | "brand" | "muted";
}>;

/** Half-tile labels — aligned with patient_app `service_grid.dart` + `string_define.dart`. */
export type DashboardHalfTileCopy = Readonly<{
  title: string;
  /** Subtitle under title (`CommonDashboardServiceCard.subtitle`). */
  meta?: string;
  /** Shown only when set (e.g. Consultation `k10Mins`); not a generic discount badge. */
  badgeText?: string;
  /** Option rows (Virtual / At Hospital, Prescribed / OTC, etc.). */
  features?: readonly DashboardHalfTileFeature[];
}>;

export const DASHBOARD_HALF_TILE_COPY: Record<DashboardHalfTileKind, DashboardHalfTileCopy> = {
  consultation: {
    title: "Consultation",
    meta: "INSTANT APPOINTMENT",
    badgeText: "10 MINS",
    features: [
      { label: "Virtual", icon: "virtual", tone: "green" },
      { label: "At Hospital", icon: "at-hospital", tone: "brand" },
    ],
  },
  dental: {
    title: "Dental",
    meta: "DENTAL BOOKING",
    features: [{ label: "At Hospital", icon: "at-hospital", tone: "brand" }],
  },
  pharmacy: {
    title: "Pharmacy",
    features: [
      { label: "Prescribed", tone: "muted" },
      { label: "OTC Products", tone: "muted" },
    ],
  },
  vaccination: {
    title: "Vaccination",
    features: [{ label: "Vaccination Center", tone: "muted" }],
  },
  vision: {
    title: "Vision",
    features: [
      { label: "Eye Checkup", tone: "muted" },
      { label: "Glasses/Lens", tone: "muted" },
    ],
  },
  mental: {
    title: "Mental Wellness",
    features: [{ label: "Mental Wellness", tone: "muted" }],
  },
  chronic: {
    title: "Chronic",
    features: [{ label: "Chronic", tone: "muted" }],
  },
  nutrition: {
    title: "Nutrition",
    features: [{ label: "Nutrition", tone: "muted" }],
  },
  gym: {
    title: "Gym Membership",
    meta: "Buy Gym memberships",
    features: [{ label: "Gym Membership", tone: "muted" }],
  },
  claim: {
    title: "Claims",
    meta: "Raise claims, check status",
    features: [{ label: "Claims", tone: "muted" }],
  },
};

/** Featured diagnostics card — `DashboardController.services` + `ServiceCard` options. */
export const DASHBOARD_DIAGNOSTICS_CARD_COPY = {
  title: "Diagnostics",
  sameDaySlot: "SAME DAY SLOT BOOKING",
  homeCollection: "Home Collection",
  atCenter: "At Center",
  badgeText: "UP TO 20% OFF",
} as const;

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
