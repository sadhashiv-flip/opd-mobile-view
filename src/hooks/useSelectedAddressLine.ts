import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  readSelectedAddress,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";

/**
 * Live-updating address line for location strips (syncs when user picks a radio in {@link AddressBottomSheet}).
 * @param fallback - Used when nothing is stored (per-screen default, e.g. lab cart long address).
 */
export function useSelectedAddressLine(fallback: string = DEFAULT_LOCATION_ADDRESS_LINE): string {
  return useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.displayLine ?? fallback,
    () => fallback,
  );
}

/** Tag from last picked address (e.g. WORK); defaults to "HOME" for strip labels. */
export function useSelectedAddressTag(defaultTag: string = "HOME"): string {
  return useSyncExternalStore(
    subscribeSelectedAddress,
    () => {
      const t = readSelectedAddress()?.tag?.trim();
      return t && t.length > 0 ? t.toUpperCase() : defaultTag;
    },
    () => defaultTag,
  );
}
