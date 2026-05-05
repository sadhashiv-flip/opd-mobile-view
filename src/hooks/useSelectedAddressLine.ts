import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  getSelectedAddressSyncSnapshot,
  readSelectedAddress,
  subscribeSelectedAddress,
  type SelectedAddressSnapshot,
} from "@/constants/selectedAddressStorage";

/**
 * Live-updating address line for location strips (syncs when user picks a radio in {@link AddressBottomSheet}).
 * @param fallback - Merged when nothing is stored (e.g. dashboard `primaryAddressLine` from API only — never a fake street).
 */
export function useSelectedAddressLine(fallback: string = DEFAULT_LOCATION_ADDRESS_LINE): string {
  return useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.displayLine ?? fallback,
    () => fallback,
  );
}

/** Subscribe to selected-address changes; returns latest snapshot (object is for render only, not the store snapshot). */
export function useSelectedAddressSnapshot(): SelectedAddressSnapshot | null {
  useSyncExternalStore(subscribeSelectedAddress, getSelectedAddressSyncSnapshot, () => "");
  return readSelectedAddress();
}

/** Tag from last picked address (e.g. WORK); empty when no snapshot unless caller overrides default. */
export function useSelectedAddressTag(defaultWhenNoSnapshot: string = ""): string {
  return useSyncExternalStore(
    subscribeSelectedAddress,
    () => {
      const snap = readSelectedAddress();
      if (!snap) return defaultWhenNoSnapshot;
      const t = snap.tag?.trim();
      return t && t.length > 0 ? t.toUpperCase() : "HOME";
    },
    () => defaultWhenNoSnapshot,
  );
}
