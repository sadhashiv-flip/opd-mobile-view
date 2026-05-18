import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  getSelectedAddressSyncSnapshot,
  hasSelectedDeliveryAddress,
  readSelectedAddress,
  subscribeSelectedAddress,
  type SelectedAddressSnapshot,
} from "@/constants/selectedAddressStorage";

/**
 * Live-updating address line for location strips (syncs when user picks a radio in {@link AddressBottomSheet}).
 * @param fallback - Optional line when nothing is stored in {@link readSelectedAddress}; keep empty so UI shows “Add delivery address”.
 */
export function useSelectedAddressLine(fallback: string = DEFAULT_LOCATION_ADDRESS_LINE): string {
  return useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.displayLine?.trim() ?? fallback,
    () => fallback,
  );
}

/** True only when the user has a saved address selected in {@link readSelectedAddress}. */
export function useHasSelectedDeliveryAddress(): boolean {
  return useSyncExternalStore(
    subscribeSelectedAddress,
    hasSelectedDeliveryAddress,
    () => false,
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
